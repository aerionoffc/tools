const { Client } = require("ssh2");

/* ===============================
   RDP INSTALLER CONFIG
================================ */

const INSTALLER_URL =
  "https://miror.aerion.web.id/auto.sh";

const INSTALLER_PASSWORD =
  process.env.RDP_INSTALLER_PASSWORD || "NAZWA@123";


/* ===============================
   RDP INSTALLER
================================ */

async function installRdp({
  host,
  username,
  sshPassword,
  os,
  rdpPassword,
  rdpPort
}) {

  return new Promise((resolve, reject) => {

    const conn = new Client();

    let output = "";
    let finished = false;

    const timeout = setTimeout(() => {

      if (finished) return;

      finished = true;

      conn.end();

      reject(
        new Error("Installer timeout")
      );

    }, 30 * 60 * 1000);


    conn.on("ready", () => {

      conn.shell(
        {
          term: "xterm",
          cols: 120,
          rows: 40
        },
        (err, stream) => {

          if (err) {

            clearTimeout(timeout);
            conn.end();

            return reject(err);
          }


          /* ===============================
             OUTPUT
          ================================= */

          stream.on("data", data => {

            const text = data.toString();

            output += text;

            console.log(
              `[RDP ${host}] ${text}`
            );

          });


          stream.stderr.on("data", data => {

            output += data.toString();

          });


          /* ===============================
             CLOSED
          ================================= */

          stream.on("close", () => {

            if (finished) return;

            finished = true;

            clearTimeout(timeout);

            conn.end();

            resolve({
              output
            });

          });


          /* ===============================
             SEND
          ================================= */

          const send = (value, delay) => {

            setTimeout(() => {

              if (finished) return;

              stream.write(
                String(value) + "\n"
              );

            }, delay);

          };


          /* ===============================
             RUN INSTALLER
          ================================= */

          stream.write(
            `bash <(curl -fsSL ${INSTALLER_URL})\n`
          );


          /*
           * Password installer
           */

          send(
            INSTALLER_PASSWORD,
            3000
          );


          /*
           * Windows OS
           *
           * 1 = Windows 11 Pro
           * 2 = Windows 10 Pro
           * 3 = Server 2012 R2
           * 4 = Server 2016
           * 5 = Server 2019
           * 6 = Server 2022
           * 7 = Server 2025
           */

          send(
            os,
            7000
          );


          /*
           * Pilih 1
           */

          send(
            "1",
            11000
          );


          /*
           * Pilih 2
           */

          send(
            "2",
            15000
          );


          /*
           * Password RDP
           */

          send(
            rdpPassword,
            19000
          );


          /*
           * Pilih 2
           */

          send(
            "2",
            23000
          );


          /*
           * Port RDP
           */

          send(
            rdpPort,
            27000
          );


          /*
           * Confirm
           */

          send(
            "y",
            31000
          );

        }
      );

    });


    conn.on("error", err => {

      if (finished) return;

      finished = true;

      clearTimeout(timeout);

      reject(err);

    });


    /* ===============================
       SSH CONNECT
    ================================= */

    conn.connect({

      host,

      port: 22,

      username:
        username || "root",

      password:
        sshPassword,

      readyTimeout: 30000,

      keepaliveInterval: 10000,

      keepaliveCountMax: 3

    });

  });

}


/* ===============================
   MODULE EXPORT
================================ */

module.exports = [

  {
    name: "RDP Installer",

    desc:
      "Install Windows RDP automatically on VPS",

    category: "RDP",

    path:
      "/rdp/install?apikey=&provider=&host=&user=&pass=&os=&rdppass=&port=",

    async run(req, res) {

      const {
        apikey,
        provider,
        host,
        user,
        pass,
        os,
        rdppass,
        port
      } = req.query;


      /* ===============================
         API KEY
      ================================= */

      if (
        !apikey ||
        !global.apikey.includes(apikey)
      ) {

        return res.json({

          status: false,

          error:
            "Apikey invalid"

        });

      }


      /* ===============================
         REQUIRED
      ================================= */

      if (!provider) {

        return res.json({

          status: false,

          error:
            "Provider is required"

        });

      }


      if (!host) {

        return res.json({

          status: false,

          error:
            "VPS host is required"

        });

      }


      if (!pass) {

        return res.json({

          status: false,

          error:
            "SSH password is required"

        });

      }


      if (!os) {

        return res.json({

          status: false,

          error:
            "OS is required"

        });

      }


      if (!rdppass) {

        return res.json({

          status: false,

          error:
            "RDP password is required"

        });

      }


      if (!port) {

        return res.json({

          status: false,

          error:
            "RDP port is required"

        });

      }


      /* ===============================
         VALID PROVIDER
      ================================= */

      const providers = [
        "digitalocean",
        "linode",
        "vultr",
        "upcloud",
        "ovhcloud",
        "other"
      ];

      if (!providers.includes(
        provider.toLowerCase()
      )) {

        return res.json({

          status: false,

          error:
            "Invalid provider",

          providers

        });

      }


      /* ===============================
         VALID OS
      ================================= */

      const osList = {

        "1": "Windows 11 Pro",

        "2": "Windows 10 Pro",

        "3": "Windows Server 2012 R2",

        "4": "Windows Server 2016",

        "5": "Windows Server 2019",

        "6": "Windows Server 2022",

        "7": "Windows Server 2025"

      };


      if (!osList[os]) {

        return res.json({

          status: false,

          error:
            "Invalid Windows OS",

          os: osList

        });

      }


      /* ===============================
         VALID PORT
      ================================= */

      const rdpPort =
        Number(port);

      if (
        !Number.isInteger(rdpPort) ||
        rdpPort < 1 ||
        rdpPort > 65535
      ) {

        return res.json({

          status: false,

          error:
            "Port must be between 1 and 65535"

        });

      }


      /* ===============================
         INSTALL
      ================================= */

      try {

        const result =
          await installRdp({

            host,

            username:
              user || "root",

            sshPassword:
              pass,

            os,

            rdpPassword:
              rdppass,

            rdpPort

          });


        return res.json({

          status: true,

          message:
            "RDP installer started/completed",

          result: {

            provider,

            host,

            username:
              user || "root",

            os:
              osList[os],

            rdp_port:
              rdpPort,

            output:
              result.output

          }

        });

      } catch (error) {

        return res.status(500).json({

          status: false,

          error:
            error.message

        });

      }

    }

  }

];
