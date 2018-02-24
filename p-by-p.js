const stream = require('stream')
const StringDecoder = require('string_decoder').StringDecoder
const path = require('path')
const fs = require('fs')
const EventEmitter = require('events').EventEmitter

var GLOBAL_HEADER_LENGTH = 24 // bytes
var PACKET_HEADER_LENGTH = 16 // bytes

let pbypProto = {
  _init () {
    const readStream = this._filepath instanceof stream.Readable
      ? this._filepath
      : fs.createReadStream(this._filepath)

    readStream.pause()

    readStream.on('error', err => {
      this._errored = true
      this.emit('error', err)
      this.close()
    })

    readStream.on('open', () => {
      this.emit('open')
    })

    readStream.on('end', () => {
      this._ending = true
      setImmediate(() => {
        this._nextLine()
      })
    })

    readStream.on('data', data => {
      this._readStream.pause()
      if (this._errored) {
        return
      }
      this._appendBuffer(data)
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
  },

  _nextLine () {
    if (this._paused) {
      return
    }

    if (this._lines.length === 0) {
      if (this._ending) {
        if (this._lineFragment) {
          this.emit('packet', this._lineFragment)
          this._lineFragment = ''
        }
        if (!this._paused) {
          this._end()
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
  },

  _end () {
    if (!this._ended) {
      this._ended = true
      this.emit('end')
    }
  },

  _appendBuffer (data) {
    if (data === null || data === undefined) {
      return
    }

    if (this._buffer === null) {
      this._buffer = data
    } else {
      const extendedBuffer = new Buffer(this._buffer.length + data.length)
      this._buffer.copy(extendedBuffer)
      data.copy(extendedBuffer, this._buffer.length)
      this._buffer = extendedBuffer
    }
  },

  resume () {
    this._paused = false
    setImmediate(() => {
      this._nextLine()
    })
  },

  pause () {
    this._paused = true
  },

  close () {
    this._readStream.destroy()
    this._ending = true

    setImmediate(() => {
      this._nextLine()
    })
  }
}

pbypProto = Object.assign(pbypProto, EventEmitter.prototype)

const packetByPacket = filePath => {
  const self = Object.create(pbypProto)

  self._lines = []
  self._lineFragment = ''
  self._paused = true
  self._ending = false
  self._ended = false
  self._filepath = filePath
  self._buffer = null
  self._errored = false
  self._decoder = new StringDecoder('utf8')

  setImmediate(() => {
    self._init()
  })
  return self
}

module.exports = packetByPacket
