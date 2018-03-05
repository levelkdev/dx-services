const debug = require('debug')('dx-service:DxApiServer')
const express = require('express')
const http = require('http')

// Constants
const DEFAULT_PORT = 8080
const DEFAULT_HOST = '0.0.0.0'
const CONTEXT_PATH = ''

class DxApiServer {
  constructor ({ port = DEFAULT_PORT, host = DEFAULT_HOST, apiService }) {
    this._port = port
    this._host = host
    this._apiService = apiService
  }

  async start () {
    // App
    const app = express()
    this._app = app

    // Define all the routes
    const routes = require('./routes')({
      apiService: this._apiService
    })
    Object.keys(routes).forEach(path => {
      const fullPath = CONTEXT_PATH + path
      debug('[app] Define path ', fullPath)
      app.use(fullPath, routes[path])
    })
    
    // Version, About (getAboutInfo)
    this._server = http.createServer(app)
    return new Promise((resolve, reject) => {
      this._server.listen(this._port, this._host, () => {
        debug(`Running API Servier on http://%s:%d`, this._host, this._port)
        debug(`Try http://%s:%d/ping to check the service is onLine`,
          this._host, this._port
        )
        resolve(this)
      })
    })
  }

  async stop () {
    if (this._server) {
      debug('Stopping server on http://%s:%d ...', this._host, this._port)
      await this._server.close()
    }

    debug('The API server has been stopped')
  }
}

module.exports = DxApiServer