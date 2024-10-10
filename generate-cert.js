const selfsigned = require('selfsigned');
const fs = require('fs');
const os = require('os');

const networkInterfaces = os.networkInterfaces();
const localNetworkIP = networkInterfaces.en0 ? networkInterfaces.en0.find(iface => iface.family === 'IPv4').address : '192.168.0.119';

const attrs = [{ name: 'commonName', value: 'localhost' }];
const pems = selfsigned.generate(attrs, {
  algorithm: 'sha256',
  days: 365,
  keySize: 2048,
  extensions: [
    {
      name: 'subjectAltName',
      altNames: [
        { type: 2, value: 'localhost' },
        { type: 2, value: localNetworkIP },
        { type: 7, ip: '127.0.0.1' },
        { type: 7, ip: localNetworkIP }
      ]
    }
  ]
});

fs.writeFileSync('cert.pem', pems.cert);
fs.writeFileSync('key.pem', pems.private);

console.log('SSL certificate generated successfully.');
console.log(`Local Network IP: ${localNetworkIP}`);