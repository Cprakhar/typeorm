import { DataSource } from "typeorm"

const dataSource = new DataSource({
    type: "mongodb",
    useNewUrlParser: true,
    useUnifiedTopology: true,
    keepAlive: true,
    ssl: true,
    sslCA: "./ca.pem",
    sslPass: "secret",
    sslValidate: true,
    w: "majority",
    wtimeoutMS: 5000,
    appname: "myapp",
    123: "noop",
})
