const PacketByPacket = require('../p-by-p')

const pbyp = PacketByPacket('./malformat.pcap')
pbyp.on('end', () => console.log('--- read ended'))
pbyp.on('packet', data => console.log(data))

pbyp.resume()