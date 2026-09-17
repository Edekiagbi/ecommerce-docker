# Online Boutique — Docker Compose + AWS ECR/ECS Deployment

This folder is **fully self-contained**. It contains the complete microservice source
code **and** everything needed to build, push, and deploy the **Online Boutique**
e-commerce demo — locally with Docker Compose, then to **AWS ECR** and **AWS ECS Fargate**.

The 10 services used here are:

| # | Service                 | Language    | Port  |
|---|-------------------------|-------------|-------|
| 1 | `frontend`              | Go          | 8080  |
| 2 | `productcatalogservice` | Go          | 3550  |
| 3 | `cartservice`           | C# (.NET)   | 7070  |
| 4 | `currencyservice`       | Node.js     | 7000  |
| 5 | `checkoutservice`       | Go          | 5050  |
| 6 | `shippingservice`       | Go          | 50051 |
| 7 | `paymentservice`        | Node.js     | 50052 |
| 8 | `emailservice`          | Python      | 8081  |
| 9 | `recommendationservice` | Python      | 8082  |
| 10| `adservice`             | Java        | 9555  |
|   | `redis-cart` (dependency) | Redis      | 6379  |

> **Why the ports differ from the upstream project** — ECS Fargate runs every container
> in the same task under one shared network namespace (`localhost`), so no two containers
> can listen on the same port. Upstream uses `emailservice:5000`, `recommendationservice:8080`,
> and `paymentservice:50051`, all of which would collide. This repo reassigns those three to
> unique ports and wires the environment variables accordingly — the same ports are used
> locally in Docker Compose so behavior is identical everywhere.

> **Network requirements**
> - **Inbound:** only the ALB is publicly reachable — HTTP **port 80** → frontend (**port 8080**).
>   No other container port is exposed to the internet.
> - **Outbound:** builds MUST reach the public package registries (npm, PyPI, NuGet, Maven,
>   Go modules) on **HTTPS outbound ports 443 (and 80)**. The ALB/tasks also use the default
>   VPC's internet gateway, so outbound internet from the ECS security group must not be blocked.
> - **`currencyservice` (port 7000):** it serves the store's currency conversion. In the version
>   bundled in `./src`, exchange rates are read from a static bundled file
>   (`src/currencyservice/data/currency_conversion.json`, data sourced from the European Central
>   Bank), so **no live outbound call is made at runtime**. If you swap in code that fetches live
>   ECB rates instead, that container will additionally need outbound HTTPS (**port 443**) to the
>   ECB endpoint.

---

## 1. Prerequisites

- **Docker** with Docker Compose v2
- **AWS CLI** v2, configured with credentials that can create ECR, ECS, ELB, IAM, EC2
  (VPC/Security Groups), and CloudWatch Logs resources
- **`jq`** (used by `deploy-ecs.sh`)
- **Bash** (Git Bash / WSL on Windows, or Linux/macOS terminal)
- A default **VPC** in your target AWS region (the deploy script auto-detects it)
- Your **AWS account ID** (12-digit number)

Verify your machine has everything by running the included checker:

```bash
./check-prereqs.sh      # checks Git, Bash, Docker, Docker Compose, AWS CLI, jq,
                        # Docker daemon, and AWS authentication
```

Example AWS CLI setup:

```bash
aws configure                        # enters access key, secret, region interactively
aws sts get-caller-identity          # confirm you are authenticated; shows Account ID
```

---

## 2. Folder layout

```
project/                        <- fully self-contained; only this folder is needed
├── deployreadme.md             <- this file
├── docker-compose.yml          <- single compose file for ALL services
├── build-and-push.sh           <- build + tag + push images to ECR
├── deploy-ecs.sh               <- provision ALB + ECS Fargate + deploy
├── check-prereqs.sh            <- verify Docker/AWS CLI/jq are installed & configured
├── src/                        <- COMPLETE microservice source code (all 12 services)
│   ├── frontend/               <- Go web frontend
│   ├── adservice/              <- Java ads service
│   ├── cartservice/            <- C# (.NET) cart + Redis
│   ├── checkoutservice/        <- Go checkout
│   ├── currencyservice/        <- Node.js currency
│   ├── emailservice/           <- Python email
│   ├── paymentservice/         <- Node.js payment
│   ├── productcatalogservice/  <- Go product catalog
│   ├── recommendationservice/  <- Python recommendations
│   ├── shippingservice/        <- Go shipping
│   ├── loadgenerator/          <- Locust load test (optional, not deployed)
│   └── shoppingassistantservice/ <- optional AI assistant (needs GCP, not deployed)
└── protos/                     <- Protocol buffer API definitions
```

> Each `src/<service>/` folder carries its own manifest (`go.mod`, `package.json`,
> `requirements.txt`, `*.csproj`, `pom.xml`) and its own `Dockerfile`. At build time the
> Dockerfiles pull all libraries from the public registries (Go modules, npm, PyPI, NuGet,
> Maven Central), so **no packages are vendored into the repo beforehand**.

> All commands below are run **from inside this `project/` folder**. This folder can be
> copied or zipped and moved to any machine that has Docker + AWS CLI installed — the app
> will build from `./src`.

---

## 3. Step 1 — Run locally with Docker Compose (optional sanity check)

```bash
# Run from the directory that contains docker-compose.yml
docker compose up -d --build
docker compose ps
```

Open **http://localhost:8080** to see the store.

```bash
docker compose logs -f frontend   # tail one service's logs
docker compose down -v            # stop and remove everything
```

Rebuild after changing source:

```bash
docker compose up -d --build
```

---

## 4. Step 2 — Build, tag, and push images to AWS ECR

Replace `123456789012` with your AWS account ID (and optionally a region):

```bash
./build-and-push.sh 123456789012 us-east-1
```

What it does:

1. Looks up the ECR password and `docker login`s to ECR
2. Creates the ECR repository **`online-boutique`** if it doesn't exist
3. Runs `docker compose build` to build all 11 images
4. Tags and pushes each one as:

```
123456789012.dkr.ecr.us-east-1.amazonaws.com/online-boutique:<service>-latest
```

Default region is `us-east-1` if you omit it.

---

## 5. Step 3 — Deploy to AWS ECS Fargate

```bash
./deploy-ecs.sh 123456789012 us-east-1
```

What it provisions (all idempotent — safe to re-run):

| # | Resource | Name |
|---|----------|------|
| 1 | Default VPC discovery | auto-detected |
| 2 | ALB security group | `online-boutique-alb-sg` |
| 3 | ECS task security group | `online-boutique-ecs-sg` |
| 4 | Application Load Balancer | `online-boutique-alb` (internet-facing) |
| 5 | Target group (frontend :8080, health check `/_healthz`) | `online-boutique-frontend-tg` |
| 6 | ALB listener | HTTP :80 → frontend target group |
| 7 | ECS cluster | `online-boutique-cluster` |
| 8 | IAM task execution role | `online-boutique-execution-role` |
| 9 | Task definition | `online-boutique-task` (Fargate, 4 vCPU / 8 GB, all 11 containers) |
| 10 | ECS service | `online-boutique-service` (desired count 1) |

When the service stabilizes, the script prints your application URL:

```
Application URL: http://online-boutique-alb-XXXX.us-east-1.elb.amazonaws.com
```

Open it in your browser. Deployment usually takes 3–5 minutes.

---

## 6. Managing the deployment

```bash
# Service status / stability
aws ecs describe-services --cluster online-boutique-cluster \
  --services online-boutique-service --region us-east-1

# Task status (running/failed, exit codes, restart reasons)
aws ecs list-tasks --cluster online-boutique-cluster --region us-east-1

# Live logs for all containers
aws logs tail /ecs/online-boutique --follow --region us-east-1

# Scale the app (runs more copies of the whole stack)
aws ecs update-service --cluster online-boutique-cluster \
  --service online-boutique-service --desired-count 3 --region us-east-1

# Redeploy after pushing updated images (forces new tasks)
aws ecs update-service --cluster online-boutique-cluster \
  --service online-boutique-service --force-new-deployment --region us-east-1
```

### Tear everything down

```bash
# Delete the service first (stops tasks), then the cluster
aws ecs delete-service --cluster online-boutique-cluster \
  --service online-boutique-service --force --region us-east-1

aws ecs delete-cluster --cluster online-boutique-cluster --region us-east-1

# Delete ALB, target group, security groups, log group, ECR repo
aws elbv2 delete-load-balancer --load-balancer-arn <ALB_ARN> --region us-east-1
aws elbv2 delete-target-group --target-group-arn <TG_ARN> --region us-east-1
aws ec2 delete-security-group --group-id <ALB_SG_ID> --region us-east-1
aws ec2 delete-security-group --group-id <ECS_SG_ID> --region us-east-1
aws logs delete-log-group --log-group-name /ecs/online-boutique --region us-east-1
aws ecr delete-repository --repository-name online-boutique --force --region us-east-1
```

---

## 7. How it works

- **One Fargate task, many containers** — all 10 services + Redis run inside a *single*
  ECS task, so they share the network namespace and reach each other on `localhost:<port>`.
- **Single ECR repository** — `online-boutique` holds all images, one tag per service
  (`frontend-latest`, `cartservice-latest`, ...).
- **One service address per port** — the `PORT` environment variable controls which port a
  service binds. Both Compose and ECS set these identically:
  - `frontend` → 8080, `productcatalogservice` → 3550, `cartservice` → 7070,
    `currencyservice` → 7000, `checkoutservice` → 5050, `shippingservice` → 50051,
    `paymentservice` → 50052, `emailservice` → 8081, `recommendationservice` → 8082,
    `adservice` → 9555, `redis` → 6379.
- **Inbound traffic** — the ALB listens on 80 and forwards to the frontend container on 8080.
  The frontend then calls every other service internally over gRPC on localhost.
- **Cart state** — `cartservice` persists carts to `redis-cart` (`REDIS_ADDR=localhost:6379`
  on ECS, `redis-cart:6379` inside Compose).
- **Logs** — every container streams to CloudWatch Logs under the group `/ecs/online-boutique`.

---

## 8. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `no configuration file provided: not found` | Run Compose from this project folder (the one that contains `docker-compose.yml`). |
| `Docker Compose is configured to build using Bake, but buildx isn't installed` | This repo ships `.env` with `COMPOSE_BAKE=false` so Compose uses the classic builder. If the warning persists, run `COMPOSE_BAKE=false docker compose up --build`. |
| `No default VPC found` | Enable a default VPC in the region, or modify `deploy-ecs.sh` to use an existing VPC ID. |
| Service stays `PROVISIONING` / tasks exit | Check `aws logs tail /ecs/online-boutique --follow` and `aws ecs list-tasks`. |
| `execution role` not found mid-script | IAM propagation delay — the script sleeps, but you can re-run it (it's idempotent). |
| Port already in use locally | Run `docker compose down` first; something else on the host may occupy a port. |
| `service not stable` / build pulls fail | Outbound internet blocked on port 443/80 — check the VPC's route table + NAT/internet gateway and ECS security group egress. |
| `currencyservice` conversion fails | It serves on port 7000; if it has no bundled `data/currency_conversion.json`, it needs outbound HTTPS (port 443) live rates — see network note above. |
| App loads but checkout fails | Confirm every container is `1/1 RUNNING` and all `localhost:<port>` envs match section 7. |
| `jq: command not found` | Install `jq` (`apt install jq` / `brew install jq`, or Chocolatey `choco install jq`). |
| `docker login` failed | Check `aws sts get-caller-identity`; your AWS profile needs ECR push permission. |