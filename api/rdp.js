const { Client } = require("ssh2");

/* =========================================================
   AERION RDP INSTALLER
========================================================= */

const INSTALLER_URL =
  "https://miror.aerion.web.id/auto.sh";

const INSTALLER_PASSWORD = "NAZWA@123";


/* =========================================================
   PROVIDER
   value yang dikirim = nomor pilihan
========================================================= */

const PROVIDERS = {
  "1": "DigitalOcean",
  "2": "Linode",
  "3": "Vultr",
  "4": "UpCloud",
  "5": "OVHcloud",
  "6": "Other Cloud"
};


/* =========================================================
   WINDOWS OS
========================================================= */

const WINDOWS = {
  "1": "Windows 11 Pro",
  "2": "Windows 10 Pro",
  "3": "Windows Server 2012 R2",
  "4": "Windows Server 2016",
  "5": "Windows Server 2019",
  "6": "Windows Server 2022",
  "7": "Windows Server 2025"
};


/* =========================================================
   VALIDATE PORT
========================================================= */

function isValidPort(port) {

  const value = Number(port);

  return (
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 65535
  );

}


/* =========================================================
   INSTALL RDP VIA SSH
========================================================= */

function installRDP({
  host,
  sshPort,
  vpsPassword,
  os,
  rdpPassword,
  rdpPort
}) {

  return new Promise((resolve, reject) => {

    const conn = new Client();

    let output = "";
    let errorOutput = "";

    let finished = false;


    function finish(result) {

      if (finished) return;

      finished = true;

      try {
        conn.end();
      } catch {}

      resolve(result);

    }


    /* =====================================================
       SSH ERROR
    ===================================================== */

    conn.on("error", err => {

      if (finished) return;

      finished = true;

      reject(err);

    });


    /* =====================================================
       SSH READY
    ===================================================== */

    conn.on("ready", () => {

      conn.shell(
        {
          term: "xterm",
          cols: 120,
          rows: 40
        },

        (err, stream) => {

          if (err) {

            conn.end();

            return reject(err);

          }


          /* =================================================
             OUTPUT
          ================================================= */

          stream.on("data", data => {

            output += data.toString();

          });


          stream.stderr.on("data", data => {

            errorOutput += data.toString();

          });


          /* =================================================
             START INSTALLER
          ================================================= */

          stream.write(
            `curl -fsSL "${INSTALLER_URL}" -o /tmp/aerion-rdp.sh\n`
          );


          setTimeout(() => {

            stream.write(
              "chmod +x /tmp/aerion-rdp.sh\n"
            );

          }, 1500);


          setTimeout(() => {

            stream.write(
              "bash /tmp/aerion-rdp.sh\n"
            );

          }, 3000);


          /*
           * Flow installer:
           *
           * Password installer
           * OS
           * 1
           * 2
           * Password RDP
           * 2
           * Port RDP
           * y
           */

          const answers = [

            INSTALLER_PASSWORD,

            String(os),

            "1",

            "2",

            String(rdpPassword),

            "2",

            String(rdpPort),

            "y"

          ];


          let index = 0;


          function sendNextAnswer() {

            if (finished) return;

            if (index >= answers.length) return;

            stream.write(
              answers[index] + "\n"
            );

            index++;

            setTimeout(
              sendNextAnswer,
              3000
            );

          }


          /* =================================================
             WAIT INSTALLER
          ================================================= */

          setTimeout(
            sendNextAnswer,
            5000
          );


          /* =================================================
             SHELL CLOSE
          ================================================= */

          stream.on("close", () => {

            finish({

              success: true,

              output,

              error: errorOutput || null

            });

          });

        }
      );

    });


    /* =====================================================
       SSH CONNECT
    ===================================================== */

    conn.connect({

      host,

      port: Number(sshPort),

      username: "root",

      password: vpsPassword,

      readyTimeout: 30000,

      keepaliveInterval: 10000,

      keepaliveCountMax: 3

    });

  });

}


/* =========================================================
   API
========================================================= */

module.exports = [

  {

    name: "RDP Installer",

    desc: "Install Windows RDP automatically",

    category: "Installer",


    /* =====================================================
       PARAMETERS
    ===================================================== */

    parameters: {

      /* API KEY */

      apikey: {
        type: "string",
        example: "your_api_key"
      },


      /* VPS HOST / IP */

      host: {
        type: "string",
        example: "1.2.3.4"
      },


      /* VPS PASSWORD */

      vps_password: {
        type: "password"
      },


      /* SSH PORT */

      vps_port: {
        type: "number",
        value: "22"
      },


      /* =================================================
         PROVIDER DROPDOWN
      ================================================= */

      provider: {

        type: "select",

        selection: [
          "1",
          "2",
          "3",
          "4",
          "5",
          "6"
        ],

        value: "1"

      },


      /* =================================================
         WINDOWS DROPDOWN
      ================================================= */

      os: {

        type: "select",

        selection: [
          "1",
          "2",
          "3",
          "4",
          "5",
          "6",
          "7"
        ],

        value: "1"

      },


      /* RDP PASSWORD */

      rdp_password: {
        type: "password"
      },


      /* RDP PORT */

      rdp_port: {
        type: "number",
        value: "3389"
      }

    },


    /* =====================================================
       ENDPOINT
    ===================================================== */

    path: "/installer/rdp",


    /* =====================================================
       RUN
    ===================================================== */

    async run(req, res) {

      const {
        apikey,
        host,
        vps_password,
        vps_port = "22",
        provider,
        os,
        rdp_password,
        rdp_port
      } = req.query;


      /* =====================================================
         API KEY
      ===================================================== */

      if (
        !apikey ||
        !global.apikey?.includes(apikey)
      ) {

        return res.status(401).json({

          status: false,

          error: "Apikey invalid"

        });

      }


      /* =====================================================
         HOST
      ===================================================== */

      if (!host) {

        return res.status(400).json({

          status: false,

          error: "Missing VPS host"

        });

      }


      /* =====================================================
         VPS PASSWORD
      ===================================================== */

      if (!vps_password) {

        return res.status(400).json({

          status: false,

          error: "Missing VPS password"

        });

      }


      /* =====================================================
         VPS PORT
      ===================================================== */

      if (!isValidPort(vps_port)) {

        return res.status(400).json({

          status: false,

          error: "Invalid VPS SSH port"

        });

      }


      /* =====================================================
         PROVIDER
      ===================================================== */

      if (!provider || !PROVIDERS[provider]) {

        return res.status(400).json({

          status: false,

          error: "Invalid provider"

        });

      }


      /* =====================================================
         OS
      ===================================================== */

      if (!os || !WINDOWS[os]) {

        return res.status(400).json({

          status: false,

          error: "Invalid Windows OS"

        });

      }


      /* =====================================================
         RDP PASSWORD
      ===================================================== */

      if (!rdp_password) {

        return res.status(400).json({

          status: false,

          error: "Missing RDP password"

        });

      }


      /* =====================================================
         RDP PORT
      ===================================================== */

      if (!rdp_port) {

        return res.status(400).json({

          status: false,

          error: "Missing RDP port"

        });

      }


      if (!isValidPort(rdp_port)) {

        return res.status(400).json({

          status: false,

          error:
            "RDP port must be between 1 and 65535"

        });

      }


      /* =====================================================
         START INSTALLATION
      ===================================================== */

      try {

        const result = await installRDP({

          host,

          sshPort: vps_port,

          vpsPassword: vps_password,

          os,

          rdpPassword: rdp_password,

          rdpPort: rdp_port

        });


        /* =================================================
           RESPONSE
        ================================================= */

        return res.status(200).json({

          status: result.success,

          message:
            "RDP installer execution completed",

          provider: {

            id: provider,

            name: PROVIDERS[provider]

          },

          windows: {

            id: os,

            name: WINDOWS[os]

          },

          vps: {

            host,

            ssh_port: Number(vps_port)

          },

          rdp: {

            port: Number(rdp_port)

          },

          output: result.output,

          error: result.error

        });

      } catch (error) {

        return res.status(500).json({

          status: false,

          error: error.message

        });

      }

    }

  }

];
