const { Client } = require("ssh2");

/* =========================================================
   AERION RDP INSTALLER
   ========================================================= */

const INSTALLER_URL =
  "https://miror.aerion.web.id/auto.sh";

/*
 * Password yang diminta oleh auto.sh
 * sesuai flow yang lu kasih.
 */
const INSTALLER_PASSWORD = "NAZWA@123";


/* =========================================================
   PROVIDER
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
   PORT VALIDATION
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


    /* =====================================================
       FINISH HELPER
    ===================================================== */

    const finish = (result) => {

      if (finished) return;

      finished = true;

      try {
        conn.end();
      } catch {}

      resolve(result);
    };


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

      /*
       * Pakai shell + PTY karena auto.sh merupakan
       * installer interaktif.
       */

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
             DATA OUTPUT
          ================================================= */

          stream.on("data", data => {

            const text = data.toString();

            output += text;

          });


          /* =================================================
             STDERR
          ================================================= */

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

          }, 2500);


          /*
           * Flow auto.sh yang lu jelaskan:
           *
           * 1. Password installer
           * 2. Pilih Windows
           * 3. Pilih 1
           * 4. Pilih 2
           * 5. Password RDP
           * 6. Pilih 2
           * 7. Port RDP
           * 8. Y
           *
           * Kita kasih jeda antar input agar menu tidak
           * menerima semua input terlalu cepat.
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


          let answerIndex = 0;


          const sendAnswer = () => {

            if (finished) return;

            if (answerIndex >= answers.length) {
              return;
            }


            const answer =
              String(answers[answerIndex]);


            stream.write(answer + "\n");


            answerIndex++;


            /*
             * Jeda antar menu.
             */

            setTimeout(sendAnswer, 3000);

          };


          /*
           * Tunggu auto.sh benar-benar start.
           */

          setTimeout(sendAnswer, 5000);


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
       CONNECT SSH
    ===================================================== */

    conn.connect({

      host: host,

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
   API MODULE
   ========================================================= */

module.exports = [

  {

    /* =====================================================
       API INFORMATION
    ===================================================== */

    name: "RDP Installer",

    desc: "Install Windows RDP automatically",

    category: "Installer",


    /* =====================================================
       PARAMETERS
    ===================================================== */

    parameters: {

      /*
       * API KEY
       */

      apikey: {
        type: "string"
      },


      /*
       * VPS IP / HOST
       */

      host: {
        type: "string"
      },


      /*
       * VPS ROOT PASSWORD
       */

      vps_password: {
        type: "password"
      },


      /*
       * SSH PORT
       */

      vps_port: {
        type: "number"
      },


      /*
       * PROVIDER DROPDOWN
       */

      provider: {
        type: "select",

        options: [

          {
            value: "1",
            label: "DigitalOcean"
          },

          {
            value: "2",
            label: "Linode"
          },

          {
            value: "3",
            label: "Vultr"
          },

          {
            value: "4",
            label: "UpCloud"
          },

          {
            value: "5",
            label: "OVHcloud"
          },

          {
            value: "6",
            label: "Other Cloud"
          }

        ]

      },


      /*
       * WINDOWS OS DROPDOWN
       */

      os: {
        type: "select",

        options: [

          {
            value: "1",
            label: "Windows 11 Pro"
          },

          {
            value: "2",
            label: "Windows 10 Pro"
          },

          {
            value: "3",
            label: "Windows Server 2012 R2"
          },

          {
            value: "4",
            label: "Windows Server 2016"
          },

          {
            value: "5",
            label: "Windows Server 2019"
          },

          {
            value: "6",
            label: "Windows Server 2022"
          },

          {
            value: "7",
            label: "Windows Server 2025"
          }

        ]

      },


      /*
       * PASSWORD RDP
       */

      rdp_password: {
        type: "password"
      },


      /*
       * PORT RDP
       */

      rdp_port: {
        type: "number"
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


      /* ===================================================
         API KEY
      =================================================== */

      if (
        !apikey ||
        !global.apikey ||
        !global.apikey.includes(apikey)
      ) {

        return res.status(401).json({

          status: false,

          error: "Apikey invalid"

        });

      }


      /* ===================================================
         VPS HOST
      =================================================== */

      if (!host) {

        return res.status(400).json({

          status: false,

          error: "Missing VPS IP / host"

        });

      }


      /* ===================================================
         VPS PASSWORD
      =================================================== */

      if (!vps_password) {

        return res.status(400).json({

          status: false,

          error: "Missing VPS password"

        });

      }


      /* ===================================================
         VPS SSH PORT
      =================================================== */

      if (!isValidPort(vps_port)) {

        return res.status(400).json({

          status: false,

          error: "Invalid VPS SSH port"

        });

      }


      /* ===================================================
         PROVIDER
      =================================================== */

      if (!provider || !PROVIDERS[provider]) {

        return res.status(400).json({

          status: false,

          error: "Invalid provider"

        });

      }


      /* ===================================================
         WINDOWS OS
      =================================================== */

      if (!os || !WINDOWS[os]) {

        return res.status(400).json({

          status: false,

          error: "Invalid Windows OS"

        });

      }


      /* ===================================================
         RDP PASSWORD
      =================================================== */

      if (!rdp_password) {

        return res.status(400).json({

          status: false,

          error: "Missing RDP password"

        });

      }


      /* ===================================================
         RDP PORT
      =================================================== */

      if (!rdp_port) {

        return res.status(400).json({

          status: false,

          error: "Missing RDP port"

        });

      }


      if (!isValidPort(rdp_port)) {

        return res.status(400).json({

          status: false,

          error: "RDP port must be between 1 and 65535"

        });

      }


      /* ===================================================
         INSTALL
      =================================================== */

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

            host: host,

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
