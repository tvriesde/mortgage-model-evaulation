using './main.bicep'

param environmentName = 'dev'
param baseName = 'mortgage-agent'
param location = 'swedencentral'
param staticWebAppLocation = 'westeurope'
param openAiApiVersion = '2024-10-21'

param model = {
  deploymentName: 'gpt-4.1'
  name: 'gpt-4.1'
  version: '2025-04-14'
  skuName: 'GlobalStandard'
  capacity: 20
}

// Optionally set to your CI service principal / user objectId to allow evaluations
// to call the model with Entra ID auth. Can also be passed via -evaluatorPrincipalId.
param evaluatorPrincipalId = ''
param evaluatorPrincipalType = 'ServicePrincipal'
