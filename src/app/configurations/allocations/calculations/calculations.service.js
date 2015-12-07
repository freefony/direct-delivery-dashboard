/**
 * Created by ehealthafrica on 7/11/15.
 */

angular.module('allocations')
  .service('calculationService', function ($q, locationService, dbService, pouchUtil, assumptionService) {
    var service = this

    service.template = {}

    service.setTemplate = function (template) {
      service.template = template
    }

    service.getLocation = function () {
      return locationService.get
    }
    service.getfacility = function () {
      return locationService.getLocationByLevel('6')
    }

    /**
     * gets target population data for facilities
     * @param facilities. object or array of facility objects, preferably from location service
     * @return facilities.  match each facility entered with corresponding returned
     * data.
     */
    service.getTargetPop = function (facilities) {
      var view = 'allocations/target-population'
      var keys = []
      var options = {
        include_docs: true
      }

      if (angular.isArray(facilities)) {
        for (var i in facilities) {
          keys.push(facilities[i]._id)
        }
      } else {
        keys.push(facilities._id)
      }
      options.keys = keys
      return dbService.getView(view, options)
        .then(pouchUtil.pluckDocs)
    }
    service.getAllocations = function (facilities) {
      var promises = {}

      function fillwithTemplate (facility, template) {
        for (var i in template.products) { // Todo: adjust this to suit the new template structure
          var coverage = parseInt(template.products[i].coverage, 10)
          var wastage = parseInt(template.products[i].wastage, 10)
          var buffer = parseInt(template.products[i].buffer, 10)
          var schedule = parseInt(template.products[i].schedule, 10)
          facility['coverage'][i] = isNaN(coverage) ? 0 : coverage
          facility['wastage'][i] = isNaN(wastage) ? 0 : wastage
          facility['schedule'][i] = isNaN(schedule) ? 0 : schedule
          facility['buffer'][i] = isNaN(buffer) ? 0 : buffer
        }
        return facility
      }

      function setAllocations () {
        var view = 'allocations/custom-templates'

        facilities.forEach(function (facility) {
          facility.coverage = {}
          facility.wastage = {}
          facility.schedule = {}
          facility.buffer = {}

          // get custom template
          return (function (v, key) {
            var opts = {
              include_docs: true,
              key: key
            }
            return dbService.getView(v, opts)
          }(view, facility._id))
        })
        return facilities
      }

      setAllocations()

      return $q.all(promises)
        .then(function (response) {
          var r = {}
          for (var i in response) {
            if (response[i].rows.length > 0) {
              r[i] = response[i].rows[0].doc
            }
          }
          return r
        })
        .then(function (r) {
          var keys = Object.keys(r)
          var index
          for (var v in facilities) {
            index = keys.indexOf(r)

            if (index !== -1) {
              console.log(r)
              fillwithTemplate(facilities[v], r[facilities[v]._id])
            } else {
              fillwithTemplate(facilities[v], service.template)
            }
          }
          console.log(facilities)
          return facilities
        })
    }

    /**
     * calculates monthly requirements using allocation
     * and target population
     * @param facilities: array
     * @returns {*} facilities inputed with MR(monthly requirement) field add to each
     */
    service.getMonthlyRequirement = function (facilities) {
      return service.getAllocations(facilities, service.template.products)
        .then(service.getTargetPop)
        .then(function (r) {
          for (var i in facilities) {
            for (var v in r) {
              if (r[v].facility._id === facilities[i]._id) {
                facilities[i].annualU1 = parseInt(r[v].annualU1, 10)
                facilities[i]['bi-weeklyU1'] = parseInt(r[v]['bi-weeklyU1'], 10)
              }
            }
          }
          return facilities
        })
        .then(function (response) {
          response.forEach(function (facility) {
            var productList = Object.keys(facility.coverage)
            var index
            facility.MR = {}
            for (var pl in productList) {
              index = productList[pl]
              console.log(facility)
              if (facility['bi-weeklyU1']) {
                facility.MR[productList[pl]] = Math.ceil((facility['bi-weeklyU1'] * 2) * (facility.coverage[index] / 100) * facility.schedule[index] * facility.wastage[index])
              } else {
                facility.MR[productList[pl]] = 'NA'
              }
            }
          })
          console.info(facilities)
          return facilities
        })
    }

    service.getMonthlyMax = function (facilities) {
      function getMax (facility) {
        var r = {}
        for (var i in facility.MR) {
          if (facility.MR[i] === 'NA') {
            r[i] = 'NA'
          } else {
            r[i] = Math.ceil(facility.MR[i] * (1 + (facility.buffer[i] / 100)))
          }
        }
        return r
      }

      return service.getMonthlyRequirement(facilities)
        .then(function (response) {
          response.forEach(function (facility) {
            facility.MMax = getMax(facility)
            return facility
          })

          return facilities
        })
    }
    service.getBiWeekly = function (facilities) {
      function setBWMax (MMax) {
        var r = {}
        for (var i in MMax) {
          if (MMax[i] === 'NA') {
            r[i] = 'NA'
          } else {
            r[i] = Math.ceil(MMax[i] / 2)
          }
        }
        return r
      }

      function setBWMin (MMax) {
        var r = {}
        for (var i in MMax) {
          if (MMax[i] === 'NA') {
            r[i] = 'NA'
          } else {
            r[i] = Math.ceil(MMax[i] * 0.25)
          }
        }
        return r
      }

      return service.getMonthlyMax(facilities)
        .then(function (response) {
          for (var i in response) {
            response[i].BWMax = setBWMax(response[i].MMax)
            response[i].BWMin = setBWMin(response[i].MMax)
          }
          return response
        })
    }
  })
