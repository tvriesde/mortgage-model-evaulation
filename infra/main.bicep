targetScope = 'resourceGroup'

import { modelConfig } from './modules/foundry.bicep'

@description('Environment short name (dev or prd).')
@allowed(['dev', 'prd'])
param environmentName string

@description('Base name prefix for all resources, e.g. mortgage-agent.')
param baseName string = 'mortgage-agent'

@description('Azure region for most resources.')
param location string = resourceGroup().location

@description('Region for the Static Web App (must be a SWA-supported region).')
param staticWebAppLocation string = 'westeurope'

@description('Chat model deployments to create (add entries to test more models).')
param models modelConfig[] = [
  {
    deploymentName: 'gpt-4.1'
    name: 'gpt-4.1'
    version: '2025-04-14'
    skuName: 'GlobalStandard'
    capacity: 20
  }
]

@description('Deployment the application uses by default (must match one of models[].deploymentName).')
param primaryDeploymentName string = 'gpt-4.1'

@description('Azure OpenAI API version used by the app and evaluations.')
param openAiApiVersion string = '2024-10-21'

@description('Optional principal (CI service principal or your user objectId) granted OpenAI User on the Foundry account so evaluations can call the model. Leave empty to skip.')
param evaluatorPrincipalId string = ''

@description('Principal type of evaluatorPrincipalId.')
@allowed(['User', 'ServicePrincipal', 'Group'])
param evaluatorPrincipalType string = 'ServicePrincipal'

var namePrefix = '${baseName}-${environmentName}'
var suffix = uniqueString(resourceGroup().id)
var storageAccountName = take(toLower(replace('${baseName}${environmentName}${suffix}', '-', '')), 24)
var customSubDomainName = toLower('${namePrefix}-${suffix}')

var tags = {
  application: 'mortgage-agent'
  environment: environmentName
  managedBy: 'bicep'
}

module monitoring 'modules/monitoring.bicep' = {
  params: {
    location: location
    namePrefix: namePrefix
    tags: tags
  }
}

module foundry 'modules/foundry.bicep' = {
  params: {
    location: location
    namePrefix: namePrefix
    customSubDomainName: customSubDomainName
    models: models
    primaryDeploymentName: primaryDeploymentName
    tags: tags
  }
}

module functions 'modules/functions.bicep' = {
  params: {
    location: location
    namePrefix: namePrefix
    storageAccountName: storageAccountName
    appInsightsConnectionString: monitoring.outputs.appInsightsConnectionString
    foundryAccountName: foundry.outputs.accountName
    openAiEndpoint: foundry.outputs.openAiEndpoint
    openAiDeployment: foundry.outputs.deploymentName
    openAiApiVersion: openAiApiVersion
    tags: tags
  }
}

module staticWebApp 'modules/staticwebapp.bicep' = {
  params: {
    location: staticWebAppLocation
    namePrefix: namePrefix
    tags: tags
  }
}

var openAiUserRoleId = '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'

resource foundryAccount 'Microsoft.CognitiveServices/accounts@2025-06-01' existing = {
  name: '${namePrefix}-aif'
}

resource evaluatorOpenAiRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(evaluatorPrincipalId)) {
  name: guid(foundryAccount.id, evaluatorPrincipalId, openAiUserRoleId)
  scope: foundryAccount
  properties: {
    principalId: evaluatorPrincipalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', openAiUserRoleId)
    principalType: evaluatorPrincipalType
  }
  dependsOn: [foundry]
}

output foundryAccountName string = foundry.outputs.accountName
output foundryProjectName string = foundry.outputs.projectName
output openAiEndpoint string = foundry.outputs.openAiEndpoint
output openAiDeployment string = foundry.outputs.deploymentName
output openAiDeployments string[] = foundry.outputs.deploymentNames
output openAiApiVersion string = openAiApiVersion
output functionAppName string = functions.outputs.functionAppName
output functionAppUrl string = functions.outputs.functionAppUrl
output staticWebAppName string = staticWebApp.outputs.staticWebAppName
output staticWebAppHostName string = staticWebApp.outputs.staticWebAppDefaultHostName
