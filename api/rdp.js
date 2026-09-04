const { Client } = require("ssh2");

/* =========================================
   RDP INSTALLER
========================================= */

const INSTALLER_URL =
  "https://miror.aerion.web.id/auto.sh";


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
   WINDOWS
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
   VALIDATE PORT
========================================= */

function isValidPort(port) {
  const number = Number(port);

  return (
    Number.isInteger(number) &&
    number >= 1 &&
    number <= 65535
  );
}


/* =========================================
   SSH INSTALLER
========================================= */

function runInstaller({
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

        const command = `
curl -fsSL "${INSTALLER_URL}" -o /tmp/auto-rdp.sh &&
chmod +x /tmp/auto-rdp.sh &&
bash /tmp/auto-rdp.sh
`;

        conn.exec(command, (err, stream) => {

          if (err) {
            conn.end();
            return reject(err);
          }

          /*
           * Urutan input auto.sh:
           *
           * 1. Password installer
           * 2. OS
           * 3. 1
           * 4. 2
           * 5. Password RDP
           * 6. 2
           * 7. Port RDP
           * 8. Y
           *
           * Password installer sesuai permintaan:
           * NAZWA@123
           */

          const answers = [
            "NAZWA@123",
            os,
            "1",
            "2",
            rdpPassword,
            "2",
            rdpPort,
            "y"
          ];

          let index = 0;

          stream.on("data", data => {

            const text = data.toString();

            output += text;

            const lower = text.toLowerCase();

            /*
             * Tunggu prompt sebelum mengirim
             * jawaban berikutnya.
             */

            if (
              lower.includes("password") ||
              lower.includes("select") ||
              lower.includes("choose") ||
              lower.includes("option") ||
              lower.includes("port") ||
              lower.includes("(y/n)") ||
              lower.includes("[y/n]")
            ) {

              if (index < answers.length) {

                stream.write(
                  String(answers[index]) + "\n"
                );

                index++;

              }

            }

          });

          stream.stderr.on("data", data => {
            error += data.toString();
          });

          stream.on("close", code => {

            conn.end();

            resolve({
              success: code === 0,
              code,
              output,
              error
            });

          });

        });

      })

      .on("error", reject)

      .connect({
        host,
        port: Number(sshPort),
        username: "root",
        password: vpsPassword,
        readyTimeout: 30000
      });

  });

}


/* =========================================
   MODULE EXPORT
========================================= */

module.exports = [

  {
    name: "RDP Installer",

    desc: "Install Windows RDP automatically",

    category: "Installer",

    /*
     * PENTING:
     * Format ini yang akan dibaca frontend
     * Laurence API untuk membuat input.
     */

    path:
      "/installer/rdp?apikey=&host=&vps_password=&vps_port=&provider=&os=&rdp_password=&rdp_port=",

    async run(req, res) {

      const {
        apikey,
        host,
        vps_password,
        vps_port = 22,
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
        !global.apikey ||
        !global.apikey.includes(apikey)
      ) {

        return res.json({
          status: false,
          error: "Apikey invalid"
        });

      }


      /* =====================================
         HOST
      ===================================== */

      if (!host) {

        return res.json({
          status: false,
          error: "VPS host/IP is required"
        });

      }


      /* =====================================
         VPS PASSWORD
      ===================================== */

      if (!vps_password) {

        return res.json({
          status: false,
          error: "VPS password is required"
        });

      }


      /* =====================================
         VPS PORT
      ===================================== */

      if (!isValidPort(vps_port)) {

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
         OS
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
          error: "RDP password is required"
        });

      }


      /* =====================================
         RDP PORT
      ===================================== */

      if (!isValidPort(rdp_port)) {

        return res.json({
          status: false,
          error: "RDP port must be between 1-65535"
        });

      }


      /* =====================================
         INSTALL
      ===================================== */

      try {

        const result = await runInstaller({

          host,

          sshPort: vps_port,

          vpsPassword: vps_password,

          os,

          rdpPassword: rdp_password,

          rdpPort: rdp_port

        });


        return res.status(
          result.success ? 200 : 500
        ).json({

          status: result.success,

          message: result.success
            ? "RDP installation completed"
            : "RDP installation failed",

          provider: PROVIDERS[provider],

          os: WINDOWS[os],

          vps: {
            host,
            port: Number(vps_port)
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
