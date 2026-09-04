const { Client } = require("ssh2");

/* =========================================================
   RDP INSTALLER
   ========================================================= */

const INSTALLER_URL =
  "https://miror.aerion.web.id/auto.sh";

const INSTALLER_PASSWORD =
  process.env.RDP_INSTALLER_PASSWORD || "NAZWA@123";


/* =========================================================
   PROVIDER
   ========================================================= */

const PROVIDERS = {
  digitalocean: "DigitalOcean",
  linode: "Linode",
  vultr: "Vultr",
  upcloud: "UpCloud",
  ovhcloud: "OVHcloud",
  other: "Other Cloud",
};


/* =========================================================
   WINDOWS
   ========================================================= */

const WINDOWS = {
  "1": {
    id: "windows11",
    name: "Windows 11 Pro",
  },

  "2": {
    id: "windows10",
    name: "Windows 10 Pro",
  },

  "3": {
    id: "server2012r2",
    name: "Windows Server 2012 R2",
  },

  "4": {
    id: "server2016",
    name: "Windows Server 2016",
  },

  "5": {
    id: "server2019",
    name: "Windows Server 2019",
  },

  "6": {
    id: "server2022",
    name: "Windows Server 2022",
  },

  "7": {
    id: "server2025",
    name: "Windows Server 2025",
  },
};


/* =========================================================
   VALIDATION
   ========================================================= */

function isValidPort(port) {
  const number = Number(port);

  return (
    Number.isInteger(number) &&
    number >= 1 &&
    number <= 65535
  );
}


function isValidPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= 6 &&
    password.length <= 128
  );
}


/* =========================================================
   INSTALL RDP VIA SSH
   ========================================================= */

function installRdp({
  host,
  username,
  sshPassword,
  os,
  rdpPassword,
  rdpPort,
}) {

  return new Promise((resolve, reject) => {

    const conn = new Client();

    let output = "";
    let closed = false;

    /*
     * Timeout 30 menit.
     */
    const timeout = setTimeout(() => {

      if (closed) return;

      closed = true;

      try {
        conn.end();
      } catch {}

      reject(
        new Error(
          "RDP installer timeout setelah 30 menit"
        )
      );

    }, 30 * 60 * 1000);


    /* =====================================================
       SSH ERROR
       ===================================================== */

    conn.on("error", (error) => {

      if (closed) return;

      closed = true;

      clearTimeout(timeout);

      reject(error);

    });


    /* =====================================================
       SSH READY
       ===================================================== */

    conn.on("ready", () => {

      /*
       * PTY diperlukan karena auto.sh bersifat interaktif.
       */

      conn.shell(
        {
          term: "xterm",
          cols: 120,
          rows: 40,
        },
        (error, stream) => {

          if (error) {

            clearTimeout(timeout);

            conn.end();

            return reject(error);
          }


          /* =================================================
             OUTPUT
             ================================================= */

          stream.on("data", (data) => {

            const text = data.toString();

            output += text;

            console.log(
              `[RDP ${host}] ${text}`
            );

          });


          stream.stderr.on("data", (data) => {

            const text = data.toString();

            output += text;

            console.error(
              `[RDP ${host}] ${text}`
            );

          });


          /* =================================================
             CLOSED
             ================================================= */

          stream.on("close", () => {

            if (closed) return;

            closed = true;

            clearTimeout(timeout);

            conn.end();

            resolve({
              success: true,
              output,
            });

          });


          /* =================================================
             SEND HELPER
             ================================================= */

          function send(value, delay) {

            setTimeout(() => {

              if (closed) return;

              stream.write(
                String(value) + "\n"
              );

            }, delay);

          }


          /* =================================================
             START INSTALLER
             ================================================= */

          stream.write(
            `bash <(curl -fsSL ${INSTALLER_URL})\n`
          );


          /*
           * Karena script auto.sh menggunakan menu interaktif,
           * input dikirim berurutan.
           *
           * Timeline:
           *
           * 0s   -> menjalankan installer
           * 3s   -> installer password
           * 7s   -> Windows OS
           * 11s  -> pilihan 1
           * 15s  -> pilihan 2
           * 19s  -> password RDP
           * 23s  -> pilihan 2
           * 27s  -> port
           * 31s  -> Y
           */


          // Password installer
          send(
            INSTALLER_PASSWORD,
            3000
          );


          // Windows OS
          send(
            os,
            7000
          );


          // Pilihan 1
          send(
            "1",
            11000
          );


          // Pilihan 2
          send(
            "2",
            15000
          );


          // Password RDP
          send(
            rdpPassword,
            19000
          );


          // Pilihan 2
          send(
            "2",
            23000
          );


          // Port RDP
          send(
            rdpPort,
            27000
          );


          // Confirm
          send(
            "y",
            31000
          );

        }
      );

    });


    /* =====================================================
       CONNECT SSH
       ===================================================== */

    conn.connect({

      host,

      port: 22,

      username:
        username || "root",

      password:
        sshPassword,

      readyTimeout: 30000,

      keepaliveInterval: 10000,

      keepaliveCountMax: 3,

    });

  });
}


/* =========================================================
   API
   ========================================================= */

module.exports = [

  {
    name: "RDP Installer",

    desc:
      "Install Windows RDP automatically on VPS",

    category: "RDP",

    /*
     * Parameter dibuat pendek supaya frontend
     * API lu gampang membaca query parameter.
     */

    path:
      "/rdp/install?apikey=&provider=&host=&user=&pass=&os=&rdppass=&port=",

    async run(req, res) {

      try {

        const {
          apikey,
          provider,
          host,
          user,
          pass,
          os,
          rdppass,
          port,
        } = req.query;


        /* =================================================
           API KEY
           ================================================= */

        if (
          !apikey ||
          !global.apikey ||
          !global.apikey.includes(apikey)
        ) {

          return res.status(401).json({

            status: false,

            error:
              "Apikey invalid",

          });

        }


        /* =================================================
           REQUIRED
           ================================================= */

        if (!provider) {

          return res.status(400).json({

            status: false,

            error:
              "Provider is required",

          });

        }


        if (!host) {

          return res.status(400).json({

            status: false,

            error:
              "VPS host/IP is required",

          });

        }


        if (!pass) {

          return res.status(400).json({

            status: false,

            error:
              "SSH password is required",

          });

        }


        if (!os) {

          return res.status(400).json({

            status: false,

            error:
              "Windows OS is required",

          });

        }


        if (!rdppass) {

          return res.status(400).json({

            status: false,

            error:
              "RDP password is required",

          });

        }


        if (!port) {

          return res.status(400).json({

            status: false,

            error:
              "RDP port is required",

          });

        }


        /* =================================================
           PROVIDER
           ================================================= */

        const providerKey =
          String(provider).toLowerCase();

        if (!PROVIDERS[providerKey]) {

          return res.status(400).json({

            status: false,

            error:
              "Invalid provider",

            available_providers:
              Object.entries(PROVIDERS).map(
                ([id, name]) => ({
                  id,
                  name,
                })
              ),

          });

        }


        /* =================================================
           OS
           ================================================= */

        const osKey =
          String(os);

        if (!WINDOWS[osKey]) {

          return res.status(400).json({

            status: false,

            error:
              "Invalid Windows OS",

            available_os:
              Object.entries(WINDOWS).map(
                ([id, value]) => ({
                  id,
                  name: value.name,
                })
              ),

          });

        }


        /* =================================================
           PORT
           ================================================= */

        if (!isValidPort(port)) {

          return res.status(400).json({

            status: false,

            error:
              "RDP port must be between 1 and 65535",

          });

        }


        /* =================================================
           RDP PASSWORD
           ================================================= */

        if (!isValidPassword(rdppass)) {

          return res.status(400).json({

            status: false,

            error:
              "RDP password must contain 6-128 characters",

          });

        }


        /* =================================================
           INSTALL
           ================================================= */

        const result = await installRdp({

          host,

          username:
            user || "root",

          sshPassword:
            pass,

          os:
            osKey,

          rdpPassword:
            rdppass,

          rdpPort:
            Number(port),

        });


        /* =================================================
           SUCCESS
           ================================================= */

        return res.status(200).json({

          status: true,

          message:
            "RDP installation completed",

          result: {

            provider:
              PROVIDERS[providerKey],

            host,

            username:
              user || "root",

            os:
              WINDOWS[osKey].name,

            rdp_port:
              Number(port),

            installer:
              "completed",

            output:
              result.output,

          },

        });

      } catch (error) {

        console.error(
          "RDP INSTALLER ERROR:",
          error
        );


        return res.status(500).json({

          status: false,

          error:
            error.message ||
            "RDP installer failed",

        });

      }

    },

  },

];
