@description('Azure region for the Foundry account.')
param location string

@description('Base name used to derive resource names.')
param namePrefix string

@description('Globally-unique custom subdomain for token-based (Entra ID) access.')
param customSubDomainName string

@description('Tags applied to all resources.')
param tags object

@description('Model deployments to create on the account (one per model to test).')
param models modelConfig[]

@description('Deployment name the application uses by default (must match one of models[].deploymentName).')
param primaryDeploymentName string

@export()
type modelConfig = {
  @description('Deployment name used by the application (AZURE_OPENAI_DEPLOYMENT).')
  deploymentName: string
  @description('Model name, e.g. gpt-4o.')
  name: string
  @description('Model version, e.g. 2024-08-06.')
  version: string
  @description('Deployment SKU name, e.g. GlobalStandard or Standard.')
  skuName: string
  @description('Deployment capacity in thousands of tokens per minute.')
  capacity: int
}

resource account 'Microsoft.CognitiveServices/accounts@2025-06-01' = {
  name: '${namePrefix}-aif'
  location: location
  tags: tags
  kind: 'AIServices'
  sku: {
    name: 'S0'
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    allowProjectManagement: true
    customSubDomainName: customSubDomainName
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
  }
}

resource project 'Microsoft.CognitiveServices/accounts/projects@2025-06-01' = {
  parent: account
  name: '${namePrefix}-proj'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    displayName: 'Mortgage agent project'
    description: 'Preliminary mortgage assessment agent and evaluations'
  }
}

// Deployments on a Cognitive Services account cannot be created concurrently,
// so serialize them with @batchSize(1) to avoid conflict errors.
@batchSize(1)
resource chatDeployments 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = [
  for model in models: {
    parent: account
    name: model.deploymentName
    sku: {
      name: model.skuName
      capacity: model.capacity
    }
    properties: {
      model: {
        format: 'OpenAI'
        name: model.name
        version: model.version
      }
      versionUpgradeOption: 'NoAutoUpgrade'
    }
  }
]

output accountId string = account.id
output accountName string = account.name
output projectName string = project.name
output openAiEndpoint string = 'https://${customSubDomainName}.openai.azure.com/'
output foundryEndpoint string = account.properties.endpoint
output deploymentName string = primaryDeploymentName
output deploymentNames string[] = [for model in models: model.deploymentName]
