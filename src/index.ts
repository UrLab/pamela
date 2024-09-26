import { exec } from "child_process";
import prisma from "./db";
import fastify, { FastifyRequest } from "fastify";
import fastifyView from "@fastify/view";
import fastifyStatic from "@fastify/static";
import pug from "pug";
import path from "path";

const app = fastify({ logger: false });

app.register(fastifyView, {
  engine: {
    pug: pug,
  },
  templates: path.join(__dirname, "views"),
});

app.register(fastifyStatic, {
  root: path.join(__dirname, "public"),
  prefix: "/",
});

app.get("/", async (request, reply) => {
  const devices = await prisma.device.findMany({
    where: {
      active: true,
    },
  });

  console.log("Devices in database:", devices);
  return reply.view("index.pug", { devices });
});

app.get("/register", async (request, reply) => {
  return reply.view("register.pug");
});

app.post("/register", async (request, reply) => {
  const { mac, name } = request.body as { mac: string; name: string };
  if (!mac || !name) {
    return reply.code(400).send("Missing mac or name");
  }
  await prisma.device.create({
    data: {
      mac: mac,
      name: name,
      ip: "", // Add the ip property here
      active: true,
    },
  });

  return reply.redirect("/");
});

async function scanArp(): Promise<Array<{ ip: string; mac: string }>> {
  return new Promise((resolve, reject) => {
    exec("arp-scan --localnet", (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        return reject(error);
      }
      const devices: Array<{ ip: string; mac: string }> = [];

      const lines = stdout.split("\n");

      for (let i = 2; i < lines.length - 4; i++) {
        const [ip, mac] = lines[i].split("\t").filter(Boolean);
        devices.push({ ip, mac });
      }

      resolve(devices);
    });
  });
}

function main() {
  scanArp()
    .then(async (devices: Array<{ ip: string; mac: string }>) => {
      console.log("Devices on network:");
      for (const device of devices) {
        console.log(`IP: ${device.ip} MAC: ${device.mac}`);
        const dbDevice = await prisma.device.findUnique({
          where: {
            mac: device.mac,
          },
        });

        if (dbDevice) {
          console.log(
            "Setting",
            dbDevice.name,
            "(",
            dbDevice.mac,
            ") to active"
          );
          dbDevice.active = true;
          dbDevice.ip = device.ip;
          await prisma.device.update({
            where: {
              mac: dbDevice.mac,
            },
            data: dbDevice,
          });
        }
      }

      await prisma.device.updateMany({
        where: {
          mac: {
            notIn: devices.map((device) => device.mac),
          },
        },
        data: {
          active: false,
        },
      });
      console.log("---------------------------------");
      setTimeout(() => {
        main();
      }, 5000);
    })
    .catch((error) => {
      console.error("Error scanning network", error);
    });
}

console.log(`


8888888b.     d8888 888b     d888 8888888888 888             d8888
888   Y88b   d88888 8888b   d8888 888        888            d88888
888    888  d88P888 88888b.d88888 888        888           d88P888
888   d88P d88P 888 888Y88888P888 8888888    888          d88P 888
8888888P" d88P  888 888 Y888P 888 888        888         d88P  888
888      d88P   888 888  Y8P  888 888        888        d88P   888
888     d8888888888 888   "   888 888        888       d8888888888
888    d88P     888 888       888 8888888888 88888888 d88P     888



`);

main();

app.listen({ port: 3000 }, (err, address) => {
  if (err) {
    console.error("error", err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});
