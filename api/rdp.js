const { Client } = require("ssh2");

/* ===============================
CONFIG
================================ */
const SCRIPT_URL = "https://miror.aerion.web.id/auto.sh";
const SCRIPT_PASS = "NAZWA@123"; // password awal yg diminta script

const PROVIDERS = ["digitalocean", "linode", "vultr", "upcloud", "ovhcloud", "other"];

const OS_MAP = {
  "1": "Windows 11 Pro",
  "2": "Windows 10 Pro",
  "3": "Windows Server 2012 R2",
  "4": "Windows Server 2016",
  "5": "Windows Server 2019",
  "6": "Windows Server 2022",
  "7": "Windows Server 2025"
};

/* ===============================
HELPERS
================================ */

// Susun inputan interaktif buat script auto.sh
function buildStdin(os, rdppass, rdpport) {
  return [
    SCRIPT_PASS,   // password awal script
    "1",           // pilih OS -> Windows
    os,            // versi Windows (1-7)
    "1",           // step lanjutan
    "2",           // set password RDP
    rdppass,       // password RDP
    "2",           // set port RDP
    rdpport,       // port RDP
    "y"            // konfirmasi
  ].join("\n") + "\n";
}

// SSH runner
function sshRun({ host, port, password, command, stdin }) {
  return new Promise((resolve, reject) => {
    const conn = new Client();

    conn
      .on("ready", () => {
        conn.exec(command, { pty: true }, (err, stream) => {
          if (err) { conn.end(); return reject(err); }

          let stdout = "", stderr = "";
          stream.on("data", d => (stdout += d.toString()));
          stream.stderr.on("data", d => (stderr += d.toString()));
          stream.on("close", (code) => {
            conn.end();
            resolve({ code, stdout, stderr });
          });

          if (stdin) stream.write(stdin);
          stream.end();
        });
      })
      .on("error", reject)
      .connect({
        host,
        port: parseInt(port) || 22,
        username: "root",   // ganti kalau user VPS bukan root
        password,
        readyTimeout: 60000
      });
  });
}

/* ===============================
MODULE EXPORT (API ROUTES)
================================ */
module.exports = [
  {
    name: "Install RDP",
    desc: "Auto installer RDP via bash script",
    category: "Tools",
    path: "/tools/install-rdp?apikey=&ipvps=&pwvps=&portvps=&provider=&os=&rdppass=&rdpport=",
    async run(req, res) {
      const {
        apikey, ipvps, pwvps, portvps,
        provider, os, rdppass, rdpport
      } = req.query;

      // ---- validasi apikey ----
      if (!apikey || !global.apikey.includes(apikey)) {
        return res.json({ status: false, error: "Apikey invalid" });
      }
      // ---- validasi input ----
      if (!ipvps || !pwvps) {
        return res.json({ status: false, error: "ipvps & pwvps wajib diisi" });
      }
      if (!provider || !PROVIDERS.includes(provider.toLowerCase())) {
        return res.json({
          status: false,
          error: `Provider harus salah satu: ${PROVIDERS.join(", ")}`
        });
      }
      if (!os || !OS_MAP[os]) {
        return res.json({
          status: false,
          error: `OS harus angka 1-7 (lihat /tools/rdp-list)`
        });
      }
      if (!rdppass) {
        return res.json({ status: false, error: "rdppass wajib diisi" });
      }
      if (!rdpport || rdpport < 1 || rdpport > 65535) {
        return res.json({ status: false, error: "rdpport harus 1-65535" });
      }

      try {
        const stdin = buildStdin(os, rdppass, rdpport);
        const command = `bash <(curl -s ${SCRIPT_URL})`;

        const result = await sshRun({
          host: ipvps,
          port: portvps || 22,
          password: pwvps,
          command,
          stdin
        });

        res.json({
          status: true,
          provider: provider.toLowerCase(),
          os: OS_MAP[os],
          rdp: {
            host: ipvps,
            port: parseInt(rdpport),
            user: "Administrator",
            pass: rdppass
          },
          exit_code: result.code,
          output: result.stdout,
          error_log: result.stderr
        });
      } catch (e) {
        res.status(500).json({ status: false, error: e.message });
      }
    }
  },

  // Endpoint bantu biar user tau list provider + OS
  {
    name: "List Provider & OS",
    desc: "Lihat daftar provider & OS RDP yang tersedia",
    category: "Tools",
    path: "/tools/rdp-list?apikey=",
    async run(req, res) {
      const { apikey } = req.query;
      if (!apikey || !global.apikey.includes(apikey)) {
        return res.json({ status: false, error: "Apikey invalid" });
      }
      res.json({
        status: true,
        providers: PROVIDERS,
        os: OS_MAP
      });
    }
  }
];
