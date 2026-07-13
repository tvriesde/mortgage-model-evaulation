@description('Azure region for the Static Web App (must be a SWA-supported region).')
param location string

@description('Base name used to derive resource names.')
param namePrefix string

@description('Tags applied to all resources.')
param tags object

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: '${namePrefix}-web'
  location: location
  tags: tags
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    // Deployment is handled by the SWA CLI / GitHub Action, not from a linked repo.
    allowConfigFileUpdates: true
  }
}

output staticWebAppName string = staticWebApp.name
output staticWebAppDefaultHostName string = staticWebApp.properties.defaultHostname
