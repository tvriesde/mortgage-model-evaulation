@description('Azure region for the Functions resources.')
param location string

@description('Base name used to derive resource names.')
param namePrefix string

@description('Storage account name (3-24 lowercase alphanumeric).')
param storageAccountName string

@description('Application Insights connection string.')
param appInsightsConnectionString string

@description('Name of the Foundry (Cognitive Services) account to grant access to.')
param foundryAccountName string

@description('Azure OpenAI endpoint used by the app.')
param openAiEndpoint string

@description('Azure OpenAI deployment name used by the app.')
param openAiDeployment string

@description('Azure OpenAI API version used by the app.')
param openAiApiVersion string

@description('Tags applied to all resources.')
param tags object

var deploymentContainerName = 'app-package'

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource deploymentContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: deploymentContainerName
  properties: {
    publicAccess: 'None'
  }
}

// ---------------------------------------------------------------------------
// Private networking for the storage account.
// The subscription enforces "public network access disabled" on storage
// accounts, so the Function App reaches storage through private endpoints via
// a delegated VNet-integration subnet.
// ---------------------------------------------------------------------------
var peSubnetName = 'snet-pe'
var functionSubnetName = 'snet-func'

resource vnet 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: '${namePrefix}-vnet'
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: ['10.20.0.0/16']
    }
    subnets: [
      {
        name: peSubnetName
        properties: {
          addressPrefix: '10.20.1.0/24'
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
      {
        name: functionSubnetName
        properties: {
          addressPrefix: '10.20.2.0/24'
          delegations: [
            {
              name: 'flexConsumptionDelegation'
              properties: {
                serviceName: 'Microsoft.App/environments'
              }
            }
          ]
        }
      }
    ]
  }
}

var storagePrivateEndpoints = [
  {
    group: 'blob'
    zone: 'privatelink.blob.${environment().suffixes.storage}'
  }
  {
    group: 'queue'
    zone: 'privatelink.queue.${environment().suffixes.storage}'
  }
  {
    group: 'table'
    zone: 'privatelink.table.${environment().suffixes.storage}'
  }
]

resource storageDnsZones 'Microsoft.Network/privateDnsZones@2020-06-01' = [
  for cfg in storagePrivateEndpoints: {
    name: cfg.zone
    location: 'global'
    tags: tags
  }
]

resource storageDnsLinks 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = [
  for (cfg, i) in storagePrivateEndpoints: {
    parent: storageDnsZones[i]
    name: 'link-to-${namePrefix}-vnet'
    location: 'global'
    properties: {
      registrationEnabled: false
      virtualNetwork: {
        id: vnet.id
      }
    }
  }
]

resource storagePes 'Microsoft.Network/privateEndpoints@2023-11-01' = [
  for cfg in storagePrivateEndpoints: {
    name: '${storageAccountName}-${cfg.group}-pe'
    location: location
    tags: tags
    properties: {
      subnet: {
        id: '${vnet.id}/subnets/${peSubnetName}'
      }
      privateLinkServiceConnections: [
        {
          name: '${cfg.group}-connection'
          properties: {
            privateLinkServiceId: storage.id
            groupIds: [cfg.group]
          }
        }
      ]
    }
  }
]

resource storagePeDnsGroups 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-11-01' = [
  for (cfg, i) in storagePrivateEndpoints: {
    parent: storagePes[i]
    name: 'default'
    properties: {
      privateDnsZoneConfigs: [
        {
          name: replace(cfg.zone, '.', '-')
          properties: {
            privateDnsZoneId: storageDnsZones[i].id
          }
        }
      ]
    }
  }
]

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${namePrefix}-flex'
  location: location
  tags: tags
  kind: 'functionapp'
  sku: {
    name: 'FC1'
    tier: 'FlexConsumption'
  }
  properties: {
    reserved: true
  }
}

var storageBlobDataOwnerRoleId = 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: '${namePrefix}-func'
  location: location
  tags: tags
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  dependsOn: [
    storagePeDnsGroups
    storageDnsLinks
  ]
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    virtualNetworkSubnetId: '${vnet.id}/subnets/${functionSubnetName}'
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storage.properties.primaryEndpoints.blob}${deploymentContainerName}'
          authentication: {
            type: 'SystemAssignedIdentity'
          }
        }
      }
      scaleAndConcurrency: {
        maximumInstanceCount: 40
        instanceMemoryMB: 2048
      }
      runtime: {
        name: 'node'
        version: '20'
      }
    }
    siteConfig: {
      vnetRouteAllEnabled: true
      cors: {
        allowedOrigins: ['*']
      }
      appSettings: [
        {
          name: 'AzureWebJobsStorage__accountName'
          value: storage.name
        }
        {
          name: 'AzureWebJobsStorage__blobServiceUri'
          value: storage.properties.primaryEndpoints.blob
        }
        {
          name: 'AzureWebJobsStorage__queueServiceUri'
          value: storage.properties.primaryEndpoints.queue
        }
        {
          name: 'AzureWebJobsStorage__tableServiceUri'
          value: storage.properties.primaryEndpoints.table
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
        {
          name: 'AZURE_OPENAI_ENDPOINT'
          value: openAiEndpoint
        }
        {
          name: 'AZURE_OPENAI_DEPLOYMENT'
          value: openAiDeployment
        }
        {
          name: 'AZURE_OPENAI_API_VERSION'
          value: openAiApiVersion
        }
      ]
    }
  }
}

// Grant the function's managed identity data-plane access to its own storage
// account (required because shared-key auth is disabled).
resource functionStorageBlobRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, functionApp.id, storageBlobDataOwnerRoleId)
  scope: storage
  properties: {
    principalId: functionApp.identity.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataOwnerRoleId)
    principalType: 'ServicePrincipal'
  }
}

resource foundryAccount 'Microsoft.CognitiveServices/accounts@2025-06-01' existing = {
  name: foundryAccountName
}

// Cognitive Services OpenAI User
var openAiUserRoleId = '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'

resource functionOpenAiRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(foundryAccount.id, functionApp.id, openAiUserRoleId)
  scope: foundryAccount
  properties: {
    principalId: functionApp.identity.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', openAiUserRoleId)
    principalType: 'ServicePrincipal'
  }
}

output functionAppName string = functionApp.name
output functionAppHostName string = functionApp.properties.defaultHostName
output functionAppUrl string = 'https://${functionApp.properties.defaultHostName}'
