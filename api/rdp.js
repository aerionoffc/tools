const { Client } = require("ssh2");

/* =================================
   RDP INSTALLER CONFIG
================================= */

const INSTALLER_URL =
  "https://miror.aerion.web.id/auto.sh";


/* =================================
   PROVIDER
================================= */

const PROVIDERS = {
  "1": "DigitalOcean",
  "2": "Linode",
  "3": "Vultr",
  "4": "UpCloud",
  "5": "OVHcloud",
  "6": "Other Cloud"
};


/* =================================
   WINDOWS OS
================================= */

const WINDOWS_OS = {
  "1": "Windows 11 Pro",
  "2": "Windows 10 Pro",
  "3": "Windows Server 2012 R2",
  "4": "Windows Server 2016",
  "5": "Windows Server 2019",
  "6": "Windows Server 2022",
  "7": "Windows Server 2025"
};


/* =================================
   VALIDATE RDP PORT
================================= */

function validPort(port) {
  const p = Number(port);

  return Number.isInteger(p) &&
    p >= 1 &&
    p <= 65535;
}


/* =================================
   INSTALL RDP
================================= */

function installRDP({
  host,
  sshPort,
  sshPassword,
  installerPassword,
  rdpPassword,
  rdpPort,
  os
}) {
  return new Promise((resolve, reject) => {

    const conn = new Client();

    let output = "";
    let errorOutput = "";

    conn
      .on("ready", () => {

        /*
         * Download installer terlebih dahulu.
         *
         * Kita sengaja tidak menggunakan:
         *
         * bash <(curl ...)
         *
         * karena stdin installer harus kita kontrol
         * untuk mengisi menu secara otomatis.
         */

        const command = `
          curl -fsSL '${INSTALLER_URL}' -o /tmp/aerion-rdp.sh &&
          chmod +x /tmp/aerion-rdp.sh &&
          bash /tmp/aerion-rdp.sh
        `;

        conn.exec(command, (err, stream) => {

          if (err) {
            conn.end();
            return reject(err);
          }

          /*
           * Jawaban menu installer.
           *
           * Sesuai flow yang lu kasih:
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
            installerPassword,
            os,
            "1",
            "2",
            rdpPassword,
            "2",
            String(rdpPort),
            "y"
          ];

          let answerIndex = 0;

          /*
           * Kirim input berdasarkan prompt.
           *
           * Ini lebih aman daripada memasukkan semua
           * jawaban sekaligus karena prompt installer
           * bisa memiliki jeda.
           */

          stream.on("data", (data) => {

            const text = data.toString();

            output += text;

            /*
             * Prompt installer lu mungkin berbeda.
             * Bagian ini dibuat cukup fleksibel.
             */

            const lower = text.toLowerCase();

            if (
              lower.includes("password") ||
              lower.includes("select") ||
              lower.includes("choose") ||
              lower.includes("option") ||
              lower.includes("port") ||
              lower.includes("(y/n)") ||
              lower.includes("[y/n]")
            ) {

              if (answerIndex < answers.length) {

                stream.write(
                  String(answers[answerIndex]) + "\n"
                );

                answerIndex++;
              }
            }
          });


          stream.stderr.on("data", (data) => {
            errorOutput += data.toString();
          });


          stream.on("close", (code) => {

            conn.end();

            resolve({
              success: code === 0,
              exit_code: code,
              output,
              error: errorOutput
            });

          });

        });

      })
      .on("error", reject)
      .connect({
        host,
        port: Number(sshPort),
        username: "root",
        password: sshPassword,
        readyTimeout: 30000
      });

  });
}


/* =================================
   MODULE EXPORT
================================= */

module.exports = [
  {
    name: "RDP Installer",

    desc: "Install Windows RDP automatically",

    category: "Installer",

    path:
      "/installer/rdp?apikey=&host=&ssh_password=&ssh_port=&provider=&os=&rdp_password=&rdp_port=&installer_password=",

    async run(req, res) {

      const {
        apikey,
        host,
        ssh_password,
        ssh_port = 22,
        provider,
        os,
        rdp_password,
        rdp_port,
        installer_password = "NAZWA@123"
      } = req.query;


      /* ===============================
         API KEY
      =============================== */

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


      /* ===============================
         REQUIRED
      =============================== */

      if (!host) {
        return res.json({
          status: false,
          error: "VPS host/IP is required"
        });
      }

      if (!ssh_password) {
        return res.json({
          status: false,
          error: "VPS SSH password is required"
        });
      }

      if (!provider || !PROVIDERS[provider]) {
        return res.json({
          status: false,
          error: "Invalid provider"
        });
      }

      if (!os || !WINDOWS_OS[os]) {
        return res.json({
          status: false,
          error: "Invalid Windows OS"
        });
      }

      if (!rdp_password) {
        return res.json({
          status: false,
          error: "RDP password is required"
        });
      }

      if (!validPort(rdp_port)) {
        return res.json({
          status: false,
          error:
            "RDP port must be between 1 and 65535"
        });
      }


      /* ===============================
         INSTALL
      =============================== */

      try {

        const result = await installRDP({
          host,
          sshPort: ssh_port,
          sshPassword: ssh_password,
          installerPassword: installer_password,
          rdpPassword: rdp_password,
          rdpPort: rdp_port,
          os
        });


        return res.status(
          result.success ? 200 : 500
        ).json({

          status: result.success,

          message: result.success
            ? "RDP installer completed"
            : "RDP installer failed",

          provider: PROVIDERS[provider],

          os: WINDOWS_OS[os],

          rdp_port: Number(rdp_port),

          exit_code: result.exit_code,

          output: result.output,

          error: result.error || null

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
