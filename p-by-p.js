const stream = require('stream')
const fs = require('fs')
const EventEmitter = require('events').EventEmitter

var GLOBAL_HEADER_LENGTH = 24 // bytes
var PACKET_HEADER_LENGTH = 16 // bytes

let pbypProto = {
  _init () {
    const readStream = this._.filepath instanceof stream.Readable
      ? this._.filepath
      : fs.createReadStream(this._.filepath)

    readStream.pause()

    readStream.on('error', err => {
      this._onError(err)
    })

    readStream.on('open', () => {
      this.emit('open')
    })

    readStream.on('end', () => {
      this._.ending = true
      setImmediate(() => {
        this._parseBuffer()
      })
    })

    readStream.on('data', data => {
      this._.readStream.pause()
      if (this._.errored) {
        return
      }
      this._appendBuffer(data)
      setImmediate(() => {
        this._parseBuffer()
      })
    })

    this._.readStream = readStream
  },

  _parseBuffer () {
    if (this._.paused || this._.ended) {
      return
    }
    const buffer = this._.buffer
    // actual parsing
    let consumedNewData = false
    if (this._.parsestate === 0) {
      if (buffer && buffer.length >= GLOBAL_HEADER_LENGTH) {
        consumedNewData = true
        const magicNumber = buffer.toString('hex', 0, 4)
        // determine pcap endianness
        if (magicNumber === 'a1b2c3d4') {
          this._.endianness = 'BE'
        } else if (magicNumber === 'd4c3b2a1') {
          this._.endianness = 'LE'
        } else {
          this._onError(new Error(`unknown magic number: ${magicNumber}`))
        }

        const globalHeader = {
          magicNumber: buffer['readUInt32' + this._.endianness](0, true),
          majorVersion: buffer['readUInt16' + this._.endianness](4, true),
          minorVersion: buffer['readUInt16' + this._.endianness](6, true),
          gmtOffset: buffer['readInt32' + this._.endianness](8, true),
          timestampAccuracy: buffer['readUInt32' + this._.endianness](12, true),
          snapshotLength: buffer['readUInt32' + this._.endianness](16, true),
          linkLayerType: buffer['readUInt32' + this._.endianness](20, true),
          endianness: this._.endianness
        }

        if (
          globalHeader.majorVersion !== 2 &&
          globalHeader.minorVersion !== 4
        ) {
          this._onError(
            new Error(
              `unsupported version ${globalHeader.majorVersion}.${globalHeader.minorVersion}. pcap-parser only parses libpcap file format 2.4`
            )
          )
        } else {
          this.emit('globalHeader', globalHeader)
          this._.buffer = buffer.slice(GLOBAL_HEADER_LENGTH)
          this._.parsestate = 1
        }
      }
    } else if (this._.parsestate === 1) {
      // toParsePacketHeader
      if (buffer.length >= PACKET_HEADER_LENGTH) {
        consumedNewData = true
        const header = {
          timestampSeconds: buffer['readUInt32' + this._.endianness](0, true),
          timestampMicroseconds: buffer['readUInt32' + this._.endianness](
            4,
            true
          ),
          capturedLength: buffer['readUInt32' + this._.endianness](8, true),
          originalLength: buffer['readUInt32' + this._.endianness](12, true)
        }
        header.timestamp = header.timestampSeconds * 1000 + Math.floor(header.timestampMicroseconds / 1000)

        this._.currentPacketHeader = header
        this._.buffer = buffer.slice(PACKET_HEADER_LENGTH)
        this._.parsestate = 2
      }
    } else if (this._.parsestate === 2) {
      // toParsePacketBody
      if (buffer.length >= this._.currentPacketHeader.capturedLength) {
        consumedNewData = true
        const data = buffer.slice(0, this._.currentPacketHeader.capturedLength)
        this.emit('packet', {
          header: this._.currentPacketHeader,
          data: data,
          index: this._.totalPackets
        })
        this._.totalPackets += 1

        this._.buffer = buffer.slice(this._.currentPacketHeader.capturedLength)
        this._.parsestate = 1
      }
    } else {
      this._onError(
        new Error(`Wrong parse state: ${this._.parsestate}, must be a bug.`)
      )
    }

    if (!consumedNewData) {
      if (this._.ending) {
        this._end()
      } else {
        this._.readStream.resume()
      }
    }
    setImmediate(() => {
      if (!this._.paused) {
        this._parseBuffer()
      }
    })
  },

  _end () {
    if (!this._.ended) {
      this._.ended = true
      this.emit('end', {
        totalBytes: this._.totalBytes,
        totalPackets: this._.totalPackets,
        errored: this._.errored
      })
    }
  },

  _appendBuffer (data) {
    if (data === null || data === undefined) {
      return
    }

    this._.totalBytes += data.length
    if (this._.buffer === null) {
      this._.buffer = data
    } else {
      const extendedBuffer = new Buffer(this._.buffer.length + data.length)
      this._.buffer.copy(extendedBuffer)
      data.copy(extendedBuffer, this._.buffer.length)
      this._.buffer = extendedBuffer
    }
  },

  _onError (err) {
    this._.errored = true
    this._.readStream && this._.readStream.close()
    this.emit('error', err)
    this.close()
  },

  // Public methods
  resume () {
    this._.paused = false
    setImmediate(() => {
      this._parseBuffer()
    })
  },

  pause () {
    this._.paused = true
  },

  close () {
    this._.readStream.destroy()
    this._.ending = true

    setImmediate(() => {
      this._parseBuffer()
    })
  }
}

pbypProto = Object.assign(pbypProto, EventEmitter.prototype)

const packetByPacket = filePath => {
  const self = Object.create(pbypProto)
  self._ = {
    paused: true,
    ending: false,
    ended: false,
    errored: false,
    filepath: filePath,
    buffer: null,
    readStream: null,
    totalBytes: 0,
    totalPackets: 0,
    endianness: 'BE',
    parsestate: 0 // 0, toParseGlobalHeader, 1, toParsePacketHeader, 2, toParsePacketBody
  }
  self._init()
  return self
}

module.exports = packetByPacket
