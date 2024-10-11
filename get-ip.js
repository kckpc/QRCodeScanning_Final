const os = require('os');

function getNetworkInterfaces() {
  const interfaces = os.networkInterfaces();
  const validInterfaces = [];

  for (const [name, infos] of Object.entries(interfaces)) {
    for (const info of infos) {
      if (info.family === 'IPv4' && !info.internal) {
        validInterfaces.push({ name, address: info.address });
      }
    }
  }

  return validInterfaces;
}

function getLocalIP() {
  const interfaces = getNetworkInterfaces();
  console.log('Available network interfaces:');
  interfaces.forEach((iface, index) => {
    console.log(`${index + 1}: ${iface.name} - ${iface.address}`);
  });

  // Check if there's an environment variable set for the IP
  if (process.env.PREFERRED_IP) {
    console.log(`Using preferred IP from environment variable: ${process.env.PREFERRED_IP}`);
    return process.env.PREFERRED_IP;
  }

  // Priority list for IP ranges
  const priorities = [
    /^192\.168\.50\./,  // Prioritize 192.168.50.x
    /^192\.168\./,      // Then any 192.168.x.x
    /^10\./,            // Then 10.x.x.x
    /^172\.(1[6-9]|2[0-9]|3[01])\./  // Then 172.16.x.x to 172.31.x.x
  ];

  for (const priority of priorities) {
    const match = interfaces.find(iface => priority.test(iface.address));
    if (match) {
      console.log(`Selected IP based on priority: ${match.address}`);
      return match.address;
    }
  }

  // If no priority match, use the first available
  if (interfaces.length > 0) {
    console.log(`Using first available IP: ${interfaces[0].address}`);
    return interfaces[0].address;
  }

  console.log('No suitable IP address found, falling back to localhost');
  return '127.0.0.1';
}

const selectedIP = getLocalIP();
console.log(`Final selected IP: ${selectedIP}`);
module.exports = selectedIP;