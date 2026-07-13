using './main.bicep'

param environmentName = 'prd'
param baseName = 'mortgage-agent'
param location = 'swedencentral'
param staticWebAppLocation = 'westeurope'
param openAiApiVersion = '2024-10-21'

param models = [
  {
    deploymentName: 'gpt-4.1'
    name: 'gpt-4.1'
    version: '2025-04-14'
    skuName: 'GlobalStandard'
    capacity: 40
  }
]

param primaryDeploymentName = 'gpt-4.1'

param evaluatorPrincipalId = ''
param evaluatorPrincipalType = 'ServicePrincipal'
