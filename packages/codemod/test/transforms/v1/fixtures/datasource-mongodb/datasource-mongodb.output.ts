import { DataSource } from "typeorm"

const dataSource = new DataSource({
    type: "mongodb",
    tls: true,
    tlsCAFile: "./ca.pem",
    tlsCertificateKeyFilePassword: "secret",

    // TODO(typeorm-v1): `sslValidate` was renamed to `tlsAllowInvalidCertificates` with inverted boolean logic. Review and invert the value.
    tlsAllowInvalidCertificates: true,

    // TODO(typeorm-v1): `w` was removed — migrate to `writeConcern: { ... }`
    w: "majority",

    // TODO(typeorm-v1): `wtimeoutMS` was removed — migrate to `writeConcern: { ... }`
    wtimeoutMS: 5000,

    appName: "myapp",
    123: "noop",
})
