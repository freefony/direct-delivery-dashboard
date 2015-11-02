'use strict'

angular.module('configurations')
  .config(function ($stateProvider, authProvider) {
    $stateProvider
      .state('reports', {
        parent: 'index',
        url: '/reports',
        templateUrl: 'app/reports/index.html',
        controller: function ($state) {
          if ($state.current.name === 'reports') {
            $state.go('reports.layout.delivery')
          }
        },
        data: {
          label: 'Reports',
          roles: [
            'direct_delivery_dashboard_accounting',
            'direct_delivery_dashboard_stakeholder'
          ]
        },
        resolve: {
          authentication: authProvider.requireAuthenticatedUser,
          authorization: authProvider.requireUserWithRoles([
            'direct_delivery_dashboard_accounting',
            'direct_delivery_dashboard_stakeholder'
          ])
        }
      })
      .state('reports.layout', {
        parent: 'reports',
        views: {
          menu: {
            templateUrl: 'app/reports/menu/menu.html'
          },
          'reports.content': {}
        }
      })
  })
