const stream = require('stream')
const StringDecoder = require('string_decoder').StringDecoder
const path = require('path')
const fs = require('fs')
const EventEmitter = require('events').EventEmitter

const packetByPacket = filePath => {
  const pbyp = Object.create(packetByPacket.prototype)
  EventEmitter.call(pbyp)

  pbyp._lines = []
  pbyp._lineFragment = ''
  pbyp._paused = true
  pbyp._end = false
  pbyp._ended = false
  pbyp._filepath = filePath
  pbyp._decoder = new StringDecoder('utf8')

  setImmediate(() => {
    pbyp._init()
  })
  return pbyp
}

packetByPacket.prototype = Object.create(EventEmitter.prototype)

packetByPacket.prototype._init = function () {
  const readStream = this._filepath instanceof stream.Readable
    ? this._filepath
    : fs.createReadStream(this._filepath)

  readStream.on('error', err => {
    this.emit('error', err)
  })

  readStream.on('open', () => {
    this.emit('open')
  })

  readStream.on('end', () => {
    this._end = true
    setImmediate(() => {
      this._nextLine()
    })
  })

  readStream.on('data', (data) => {
    this._readStream.pause()
    let dataAsString = data
    if (data instanceof Buffer) {
      dataAsString = this._decoder.write(data)
    }
    this._lines = this._lines.concat(dataAsString.split(/(?:\n|\r\n|\r)/g))

    this._lines[0] = this._lineFragment + this._lines[0]
    this._lineFragment = this._lines.pop() || ''

    setImmediate(() => {
      this._nextLine()
    })
  })

  this._readStream = readStream
}

packetByPacket.prototype._nextLine = function () {
  if (this._paused) {
    return
  }

  if (this._lines.length === 0) {
    if (this._end) {
      if (this._lineFragment) {
        this.emit('packet', this._lineFragment)
        this._lineFragment = ''
      }
      if (!this._paused) {
        this.end()
      }
    } else {
      this._readStream.resume()
    }
    return
  }

  line = this._lines.shift()

  if (!this._skipEmptyLines || line.length > 0) {
    this.emit('packet', line)
  }

  setImmediate(() => {
    if (!this._paused) {
      this._nextLine()
    }
  })
}

packetByPacket.prototype.end = function () {
  if (!this._ended) {
    this._ended = true
    this.emit('end')
  }
}

packetByPacket.prototype.resume = function () {
  this._paused = false
  setImmediate(() => {
    this._nextLine()
  })
}

packetByPacket.prototype.pause = function () {
  this._paused = true
}

packetByPacket.prototype.close = function () {
  this._readStream.destroy()
  this._end = true

  setImmediate(() => {
    this._nextLine()
  })
}

module.exports = packetByPacket
