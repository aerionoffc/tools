const { Client } = require("ssh2");

/* ===============================
   RDP INSTALLER CONFIG
================================ */

const INSTALLER_URL =
  "https://miror.aerion.web.id/auto.sh";

const INSTALLER_PASSWORD =
  process.env.RDP_INSTALLER_PASSWORD || "NAZWA@123";


/* ===============================
   PROVIDER
================================ */

const PROVIDERS = {
  digitalocean: "DigitalOcean",
  linode: "Linode",
  vultr: "Vultr",
  upcloud: "UpCloud",
  ovhcloud: "OVHcloud",
  other: "Other Cloud",
};


/* ===============================
   WINDOWS OS
================================ */

const WINDOWS_OS = {
  windows11: {
    name: "Windows 11 Pro",
    menu: "1",
  },

  windows10: {
    name: "Windows 10 Pro",
    menu: "2",
  },

  server2012r2: {
    name: "Windows Server 2012 R2",
    menu: "3",
  },

  server2016: {
    name: "Windows Server 2016",
    menu: "4",
  },

  server2019: {
    name: "Windows Server 2019",
    menu: "5",
  },

  server2022: {
    name: "Windows Server 2022",
    menu: "6",
  },

  server2025: {
    name: "Windows Server 2025",
    menu: "7",
  },
};


/* ===============================
   VALIDATION
================================ */

function validPort(port) {
  const n = Number(port);

  return Number.isInteger(n) &&
    n >= 1 &&
    n <= 65535;
}


function validPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= 6 &&
    password.length <= 128
  );
}


/* ===============================
   SSH INSTALLER
================================ */

function installRdp({
  host,
  username = "root",
  sshPassword,
  os,
  rdpPassword,
  rdpPort,
}) {
  return new Promise((resolve, reject) => {

    const conn = new Client();

    let output = "";
    let finished = false;

    const timeout = setTimeout(() => {
      if (!finished) {
        finished = true;
        conn.end();

        reject(
          new Error("Installer timeout")
        );
      }
    }, 30 * 60 * 1000);


    conn.on("ready", () => {

      conn.shell((err, stream) => {

        if (err) {
          clearTimeout(timeout);
          conn.end();
          return reject(err);
        }


        const send = (value, delay = 800) => {
          setTimeout(() => {
            stream.write(value + "\n");
          }, delay);
        };


        stream.on("data", (data) => {

          const text = data.toString();

          output += text;

          console.log(
            `[RDP ${host}] ${text}`
          );


          /*
           * Installer flow:
           *
           * bash <(curl ...)
           * password
           * OS
           * 1
           * 2
           * RDP password
           * 2
           * RDP port
           * y
           */


          if (
            /password|pass|Masukkan|Password/i.test(text)
            &&
            !output.includes("__RDP_PASSWORD_SENT__")
          ) {

            stream.write(
              INSTALLER_PASSWORD + "\n"
            );

            output +=
              "\n__RDP_PASSWORD_SENT__\n";
          }


          /*
           * Setelah installer meminta pilihan OS.
           *
           * Kita tidak langsung mengirim semua input sekaligus.
           * Delay dibuat supaya installer interaktif punya waktu
           * memproses setiap pilihan.
           */

        });


        stream.stderr.on("data", (data) => {
          output += data.toString();
        });


        stream.on("close", () => {

          clearTimeout(timeout);

          if (finished) return;

          finished = true;

          conn.end();

          resolve({
            success: true,
            output,
          });
        });


        /*
         * Jalankan installer
         */

        stream.write(
          `bash <(curl -s ${INSTALLER_URL})\n`
        );


        /*
         * Karena installer bersifat interaktif,
         * input dikirim berurutan.
         */

        send(
          INSTALLER_PASSWORD,
          1500
        );

        send(
          WINDOWS_OS[os].menu,
          3500
        );

        send(
          "1",
          5500
        );

        send(
          "2",
          7500
        );

        send(
          rdpPassword,
          9500
        );

        send(
          "2",
          11500
        );

        send(
          String(rdpPort),
          13500
        );

        send(
          "y",
          15500
        );

      });

    });


    conn.on("error", (err) => {

      clearTimeout(timeout);

      if (finished) return;

      finished = true;

      reject(err);

    });


    conn.connect({
      host,
      port: 22,
      username,
      password: sshPassword,

      readyTimeout: 30000,

      algorithms: {
        serverHostKey: [
          "ssh-ed25519",
          "ecdsa-sha2-nistp256",
          "rsa-sha2-512",
          "rsa-sha2-256",
        ],
      },
    });

  });
}


/* ===============================
   API ROUTE
================================ */

module.exports = [

  {
    name: "RDP Installer",

    desc:
      "Install Windows RDP automatically on a VPS",

    category: "RDP",

    path:
      "/rdp/install?apikey=&provider=&host=&username=&ssh_password=&os=&rdp_password=&port=",

    async run(req, res) {

      const {
        apikey,
        provider,
        host,
        username,
        ssh_password,
        os,
        rdp_password,
        port,
      } = req.query;


      /* ===============================
         API KEY
      ================================ */

      if (
        !apikey ||
        !global.apikey ||
        !global.apikey.includes(apikey)
      ) {
        return res.status(401).json({
          status: false,
          error: "Apikey invalid",
        });
      }


      /* ===============================
         REQUIRED
      ================================ */

      if (
        !provider ||
        !host ||
        !ssh_password ||
        !os ||
        !rdp_password ||
        !port
      ) {
        return res.status(400).json({
          status: false,
          error:
            "provider, host, ssh_password, os, rdp_password and port are required",
        });
      }


      /* ===============================
         PROVIDER CHECK
      ================================ */

      if (!PROVIDERS[provider]) {

        return res.status(400).json({
          status: false,
          error: "Invalid provider",

          available_providers:
            Object.keys(PROVIDERS),
        });

      }


      /* ===============================
         OS CHECK
      ================================ */

      if (!WINDOWS_OS[os]) {

        return res.status(400).json({
          status: false,
          error: "Invalid Windows OS",

          available_os:
            Object.entries(WINDOWS_OS)
              .map(([key, value]) => ({
                id: key,
                name: value.name,
              })),
        });

      }


      /* ===============================
         PORT CHECK
      ================================ */

      if (!validPort(port)) {

        return res.status(400).json({
          status: false,
          error:
            "RDP port must be between 1 and 65535",
        });

      }


      /* ===============================
         RDP PASSWORD CHECK
      ================================ */

      if (!validPassword(rdp_password)) {

        return res.status(400).json({
          status: false,
          error:
            "RDP password must be 6-128 characters",
        });

      }


      try {

        const result = await installRdp({

          host,

          username:
            username || "root",

          sshPassword:
            ssh_password,

          os,

          rdpPassword:
            rdp_password,

          rdpPort:
            port,

        });


        return res.status(200).json({

          status: true,

          message:
            "RDP installer completed",

          provider:
            PROVIDERS[provider],

          host,

          os:
            WINDOWS_OS[os].name,

          rdp_port:
            Number(port),

          result,

        });

      } catch (error) {

        return res.status(500).json({

          status: false,

          error:
            error.message,

        });

      }

    },
  },

];
