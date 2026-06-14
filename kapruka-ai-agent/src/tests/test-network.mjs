import dns from "dns/promises";
import { Resolver } from "dns/promises";
import net from "net";

const host = "velora.brzhqxe.mongodb.net";

console.log(`=== TESTING NETWORK CONNECTIVITY TO MONGO HOST: ${host} ===\n`);

async function runTest() {
  // Check general DNS / Internet connectivity first
  try {
    console.log("0. Testing general internet DNS resolution (google.com)...");
    const googleLookup = await dns.lookup("google.com");
    console.log("✅ General DNS working. google.com resolved to:", googleLookup.address);
  } catch (dnsErr) {
    console.error("❌ General DNS resolution failed (google.com):", dnsErr.message);
    console.log("👉 It seems your internet connection is down, or your system's DNS servers are not responding.");
  }

  // Check with Local DNS
  console.log("\n1. [Local DNS] Resolving DNS SRV record for _mongodb._tcp.velora.brzhqxe.mongodb.net...");
  try {
    const srvRecords = await dns.resolveSrv(`_mongodb._tcp.${host}`);
    console.log(`✅ [Local DNS] SRV Records found:`, JSON.stringify(srvRecords, null, 2));
  } catch (srvErr) {
    console.error(`❌ [Local DNS] SRV Record resolution failed:`, srvErr.message);
  }

  // Check with Google DNS (8.8.8.8) to bypass local DNS
  console.log("\n2. [Google DNS (8.8.8.8)] Resolving DNS SRV record for _mongodb._tcp.velora.brzhqxe.mongodb.net...");
  const googleResolver = new Resolver();
  googleResolver.setServers(["8.8.8.8"]);
  try {
    const srvRecordsGoogle = await googleResolver.resolveSrv(`_mongodb._tcp.${host}`);
    console.log(`✅ [Google DNS] SRV Records found:`, JSON.stringify(srvRecordsGoogle, null, 2));
    
    // Test TCP connection to each SRV target
    for (const record of srvRecordsGoogle) {
      const targetHost = record.name;
      const targetPort = record.port;
      console.log(`\n3. Testing TCP connection to SRV target: ${targetHost}:${targetPort}...`);
      await testTcp(targetHost, targetPort);
    }
    return; // Exit if successful
  } catch (googleSrvErr) {
    console.error(`❌ [Google DNS] SRV Record resolution failed:`, googleSrvErr.message);
  }

  // Standard lookup check with Google DNS
  console.log(`\n4. [Google DNS] Attempting standard A/AAAA record DNS lookup for: ${host}...`);
  try {
    const lookupResultGoogle = await googleResolver.resolve4(host);
    console.log(`✅ [Google DNS] Standard DNS resolved:`, lookupResultGoogle);
  } catch (googleLookupErr) {
    console.error(`❌ [Google DNS] Standard DNS lookup also failed:`, googleLookupErr.message);
    console.log("\n👉 CRITICAL CONCLUSION:");
    console.log("Since Google DNS (8.8.8.8) also failed to resolve this host, the cluster 'velora.brzhqxe.mongodb.net' likely DOES NOT EXIST.");
    console.log("Please check if the cluster has been deleted, paused, or if there is a typo in the hostname inside your .env file.");
  }
}

function testTcp(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    
    socket.setTimeout(5000); // 5 seconds timeout

    socket.connect(port, host, () => {
      console.log(`   ✅ TCP connection to ${host}:${port} SUCCESSFUL!`);
      socket.destroy();
      resolve(true);
    });

    socket.on("error", (err) => {
      console.error(`   ❌ TCP connection to ${host}:${port} FAILED:`, err.message);
      socket.destroy();
      resolve(false);
    });

    socket.on("timeout", () => {
      console.error(`   ❌ TCP connection to ${host}:${port} TIMEOUT (Firewall/Whitelisting issue?)`);
      socket.destroy();
      resolve(false);
    });
  });
}

runTest();
