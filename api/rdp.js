const { Client } = require("ssh2");

/* =========================================
   RDP INSTALLER
========================================= */

const INSTALLER_URL =
  "https://miror.aerion.web.id/auto.sh";

const INSTALLER_PASSWORD = "NAZWA@123";


/* =========================================
   PROVIDER
========================================= */

const PROVIDERS = {
  "1": "DigitalOcean",
  "2": "Linode",
  "3": "Vultr",
  "4": "UpCloud",
  "5": "OVHcloud",
  "6": "Other Cloud"
};


/* =========================================
   WINDOWS OS
========================================= */

const WINDOWS = {
  "1": "Windows 11 Pro",
  "2": "Windows 10 Pro",
  "3": "Windows Server 2012 R2",
  "4": "Windows Server 2016",
  "5": "Windows Server 2019",
  "6": "Windows Server 2022",
  "7": "Windows Server 2025"
};


/* =========================================
   PORT VALIDATION
========================================= */

function validPort(port) {
  const p = Number(port);

  return (
    Number.isInteger(p) &&
    p >= 1 &&
    p <= 65535
  );
}


/* =========================================
   SSH INSTALLER
========================================= */

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
    let error = "";

    conn
      .on("ready", () => {

        /*
         * Pakai shell + PTY karena auto.sh
         * merupakan installer interaktif.
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

            stream.on("data", data => {
              output += data.toString();
            });

            stream.stderr.on("data", data => {
              error += data.toString();
            });

            /*
             * Download installer
             */

            stream.write(
              `curl -fsSL "${INSTALLER_URL}" -o /tmp/aerion-rdp.sh\n`
            );

            setTimeout(() => {

              stream.write(
                `chmod +x /tmp/aerion-rdp.sh\n`
              );

            }, 1000);

            setTimeout(() => {

              stream.write(
                `bash /tmp/aerion-rdp.sh\n`
              );

            }, 1500);


            /*
             * Tunggu installer tampil.
             *
             * Urutan sesuai flow auto.sh:
             *
             * password installer
             * OS
             * 1
             * 2
             * password RDP
             * 2
             * port RDP
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

            /*
             * Kirim input satu per satu.
             *
             * Delay dibuat supaya menu tidak
             * menerima input terlalu cepat.
             */

            const sendNext = () => {

              if (index >= answers.length) {
                return;
              }

              stream.write(
                String(answers[index]) + "\n"
              );

              index++;

              setTimeout(sendNext, 2500);
            };


            /*
             * Beri waktu auto.sh untuk start.
             */

            setTimeout(sendNext, 5000);


            /*
             * Jika proses selesai.
             */

            stream.on("close", () => {

              conn.end();

              resolve({
                success: true,
                output,
                error
              });

            });

          }
        );

      })

      .on("error", err => {
        reject(err);
      })

      .connect({
        host,
        port: Number(sshPort),
        username: "root",
        password: vpsPassword,
        readyTimeout: 30000,
        keepaliveInterval: 10000
      });

  });
}


/* =========================================
   API MODULE
========================================= */

module.exports = [

  {
    name: "RDP Installer",

    desc: "Install Windows RDP automatically",

    category: "Installer",

    /*
     * Ini bagian PALING PENTING.
     *
     * Frontend Laurence lu membaca object
     * parameters untuk membuat form.
     */

    parameters: {

      apikey: {
        type: "string"
      },

      host: {
        type: "string"
      },

      vps_password: {
        type: "string"
      },

      vps_port: {
        type: "string"
      },

      provider: {
        type: "string"
      },

      os: {
        type: "string"
      },

      rdp_password: {
        type: "string"
      },

      rdp_port: {
        type: "string"
      }

    },

    path: "/installer/rdp",

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


      /* =====================================
         API KEY
      ===================================== */

      if (
        !apikey ||
        !global.apikey?.includes(apikey)
      ) {

        return res.json({
          status: false,
          error: "Apikey invalid"
        });

      }


      /* =====================================
         VPS HOST
      ===================================== */

      if (!host) {

        return res.json({
          status: false,
          error: "Missing VPS host/IP"
        });

      }


      /* =====================================
         VPS PASSWORD
      ===================================== */

      if (!vps_password) {

        return res.json({
          status: false,
          error: "Missing VPS password"
        });

      }


      /* =====================================
         VPS SSH PORT
      ===================================== */

      if (!validPort(vps_port)) {

        return res.json({
          status: false,
          error: "Invalid VPS port"
        });

      }


      /* =====================================
         PROVIDER
      ===================================== */

      if (!provider || !PROVIDERS[provider]) {

        return res.json({
          status: false,
          error: "Invalid provider"
        });

      }


      /* =====================================
         WINDOWS OS
      ===================================== */

      if (!os || !WINDOWS[os]) {

        return res.json({
          status: false,
          error: "Invalid Windows OS"
        });

      }


      /* =====================================
         RDP PASSWORD
      ===================================== */

      if (!rdp_password) {

        return res.json({
          status: false,
          error: "Missing RDP password"
        });

      }


      /* =====================================
         RDP PORT
      ===================================== */

      if (!validPort(rdp_port)) {

        return res.json({
          status: false,
          error: "RDP port must be between 1-65535"
        });

      }


      /* =====================================
         INSTALL
      ===================================== */

      try {

        const result = await installRDP({

          host,

          sshPort: vps_port,

          vpsPassword: vps_password,

          os,

          rdpPassword: rdp_password,

          rdpPort: rdp_port

        });


        return res.status(200).json({

          status: result.success,

          message: "RDP installer started",

          provider: {
            id: provider,
            name: PROVIDERS[provider]
          },

          os: {
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

          error: result.error || null

        });


      } catch (err) {

        return res.status(500).json({

          status: false,

          error: err.message

        });

      }

    }

  }

];
