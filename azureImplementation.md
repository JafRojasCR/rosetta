# Azure deployment guide (ACR + App Service / ACI)

This guide shows how to push the `frontend` and `backend` images to Azure and run them using Azure Container Registry (ACR) and either Azure App Service for Containers or Azure Container Instances (ACI). It includes both Portal and CLI steps and how to set environment variables in Azure.

Prerequisites
- An Azure subscription and Azure Portal access
- Install the Azure CLI (https://learn.microsoft.com/cli/azure/install-azure-cli)
- Docker installed locally (to build and push images)

Overview
1. Create a Resource Group
2. Create Azure Container Registry (ACR)
3. Build and push images to ACR
4. Deploy to Azure (choose App Service for Containers or ACI)
5. Configure environment variables (App Settings)

Step 1 — Create a Resource Group (Portal)
1. In the Azure Portal, click **Create a resource** → **Resource group**.
2. Choose a Subscription, pick a name (e.g., `rg-rosetta`) and a region, then click **Review + create** → **Create**.

Step 2 — Create an Azure Container Registry (Portal)
1. In the Portal click **Create a resource** → search **Container Registry** → **Create**.
2. Fill in:
   - Subscription: your subscription
   - Resource group: `rg-rosetta`
   - Registry name: `rosettaregistry` (must be globally unique)
   - SKU: `Basic` is fine for testing
3. Click **Review + create** → **Create**.

Step 3 — Build and push your images (local CLI)

1. Log into Azure and ACR from the CLI:

```bash
az login
# Set subscription if needed
az account set -s "<your-subscription-id-or-name>"

# Log in to ACR (replace rosettaregistry with your registry name)
az acr login --name rosettaregistry
```

2. Build and tag images locally (from repo root):

```bash
# Backend: build and tag for ACR
docker build -t rosettaregistry.azurecr.io/rosetta-backend:latest -f server/Dockerfile server/

# Frontend: build and tag. Use the public backend URL when the frontend and backend are deployed separately.
docker build \
  --build-arg VITE_API_URL=https://<your-backend-app>.azurewebsites.net/api \
  -t rosettaregistry.azurecr.io/rosetta-frontend:latest \
  -f client/Dockerfile client/
```

3. Push to ACR:

```bash
docker push rosettaregistry.azurecr.io/rosetta-backend:latest
docker push rosettaregistry.azurecr.io/rosetta-frontend:latest
```

Notes: If push fails with authentication errors, ensure `az acr login` succeeded. You can also enable admin user on the ACR resource (Portal → Access keys) for username/password docker login, but using `az acr login` is preferred.

Step 4A — Deploy using Azure App Service for Containers (recommended for web apps)

1. Create App Service Plan (Portal):
   - Create a **App Service** → **Create**.
   - Choose Docker Container as the Publish option.
   - For OS choose Linux.
   - In **Docker** settings select **Single Container** then choose **Azure Container Registry**.
   - Select your ACR and the image `rosetta-backend:latest` for the backend app.
2. Configure the backend App Service:
   - In **Settings → Configuration → Application settings**, add the environment variables from `server/.env` (e.g., `MONGODB_URI`, `JWT_SECRET`, `GCS_CREDENTIALS_BASE64`, `GCS_BUCKET_NAME`, etc.).
   - Save and restart the app.
3. Create a second App Service for the frontend (or use a static hosting option):
   - For the frontend you can use App Service for Containers with the `rosetta-frontend` image or use Azure Static Web Apps (recommended if you want CDN and serverless APIs).
   - Important: the frontend container's nginx config proxies `/api` to `http://backend:3000`. That works in local Docker Compose because Compose provides the `backend` hostname, but it will not work when the frontend and backend are deployed as separate Azure services. In Azure, build the frontend image with the backend's public URL (for example `https://<your-backend-app>.azurewebsites.net/api`) or place both behind a shared reverse proxy.

Step 4B — Deploy using Azure Container Instances (quick, per-container)

1. Use the Portal: **Create a resource** → **Container Instances** → **Create**.
2. Provide name, choose resource group and region.
3. Under **Image source** choose **Azure Container Registry** and pick your image.
4. In **Networking** select public IP if you want direct public access and open the container port (3000 for backend, 80 for frontend).
5. Under **Advanced** → **Environment variables**, paste key/value pairs from `server/.env` (sensitive values must be managed carefully). Click **Create**.

Step 5 — Configure environment variables in Azure (App Service example)

1. In the Portal open your App Service instance.
2. Go to **Configuration → Application settings**.
3. Add the required settings (e.g., `MONGODB_URI`, `JWT_SECRET`, `GCS_ENABLED`, `GCS_CREDENTIALS_BASE64`, `GCS_BUCKET_NAME`, `EMAIL_*`, etc.).
4. Save and restart the app.

Handling `GCS_CREDENTIALS_BASE64` securely
- In `server/.env` you set `GCS_CREDENTIALS_BASE64` as the base64-encoded service account JSON. In Azure App Service put the same string as an application setting. The app decodes it at runtime (the code already reads `gcsCredentialsBase64`).

Alternative: Use Managed Identity and grant permissions to GCS (not covered here) — GCP IAM integration with Azure is non-trivial.

CI/CD Option (GitHub Actions)
- You can automate build & push using GitHub Actions with `azure/docker-login` and `docker/build-push-action` to build and push images to ACR on each merge.

Useful CLI references

```bash
# Login to Azure
az login
# Create resource group
az group create -n rg-rosetta -l eastus
# Create ACR
az acr create -n rosettaregistry -g rg-rosetta --sku Basic
# Show ACR login server
az acr show -n rosettaregistry -g rg-rosetta --query loginServer -o tsv
# Push an image (example)
az acr login --name rosettaregistry
docker tag rosetta-backend:latest rosettaregistry.azurecr.io/rosetta-backend:latest
docker push rosettaregistry.azurecr.io/rosetta-backend:latest
```

Troubleshooting & tips
- If App Service fails to start, check **Diagnose and solve problems** and the container logs in **Log stream**.
- If environment variables appear masked or truncated, ensure they're not exceeding Azure App Service limits; use Key Vault integration for very large secrets.
- For production choose a higher App Service Plan SKU and configure TLS, custom domains, and autoscaling.

Security note
- Never store raw service account JSON in plaintext in source. Use Azure Key Vault or the App Service configuration (which is encrypted at rest) and restrict access.
