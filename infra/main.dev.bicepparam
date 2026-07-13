using './main.bicep'

param environmentName = 'dev'
param baseName = 'mortgage-agent'
param location = 'swedencentral'
param staticWebAppLocation = 'westeurope'
// gpt-5 (reasoning) requires a newer API version than the older 2024-10-21.
param openAiApiVersion = '2025-04-01-preview'

// All models are deployed side-by-side; the eval harness can target any of them
// via run-evals.ps1 -Deployment <name>. The app uses primaryDeploymentName.
param models = [
  {
    deploymentName: 'gpt-4.1'
    name: 'gpt-4.1'
    version: '2025-04-14'
    skuName: 'GlobalStandard'
    capacity: 20
  }
  {
    deploymentName: 'gpt-4.1-mini'
    name: 'gpt-4.1-mini'
    version: '2025-04-14'
    skuName: 'GlobalStandard'
    capacity: 20
  }
  {
    deploymentName: 'gpt-5'
    name: 'gpt-5'
    version: '2025-08-07'
    skuName: 'GlobalStandard'
    capacity: 20
  }
]

param primaryDeploymentName = 'gpt-4.1'

// Optionally set to your CI service principal / user objectId to allow evaluations
// to call the model with Entra ID auth. Can also be passed via -evaluatorPrincipalId.
param evaluatorPrincipalId = ''
param evaluatorPrincipalType = 'ServicePrincipal'
