import "reflect-metadata"
import { expect } from "chai"
import { DataSource } from "../../../src/data-source/DataSource"
import {
    closeTestingConnections,
    createTestingConnections,
    reloadTestingDatabases,
} from "../../utils/test-utils"
import { Post, PostV2 } from "./entity/Post"
import { DriverUtils } from "../../../src/driver/DriverUtils"
import { Faculty } from "./entity/Faculty"
import { Student } from "./entity/Student"
import { Teacher } from "./entity/Teacher"

describe("query runner > drop table", () => {
    describe("mysql family drivers", () => {
        let connections: DataSource[]
        before(async () => {
            connections = await createTestingConnections({
                entities: [PostV2, Teacher, Student, Faculty],
                schemaCreate: true,
                enabledDrivers: ["mysql", "mariadb"],
            })
        })
        beforeEach(() => reloadTestingDatabases(connections))
        after(() => closeTestingConnections(connections))

        it("should correctly drop table without relations and revert drop", () =>
            Promise.all(
                connections.map(async (connection) => {
                    const queryRunner = connection.createQueryRunner()

                    let table = await queryRunner.getTable("post_v2")
                    table!.should.exist

                    await queryRunner.dropTable("post_v2")

                    table = await queryRunner.getTable("post_v2")
                    expect(table).to.be.undefined

                    await queryRunner.executeMemoryDownSql()

                    table = await queryRunner.getTable("post_v2")
                    table!.should.exist

                    await queryRunner.release()
                }),
            ))

        it("should correctly drop table with relations and revert drop", () =>
            Promise.all(
                connections.map(async (connection) => {
                    const queryRunner = connection.createQueryRunner()

                    let studentTable = await queryRunner.getTable("student")
                    let teacherTable = await queryRunner.getTable("teacher")
                    let facultyTable = await queryRunner.getTable("faculty")
                    studentTable!.should.exist
                    teacherTable!.should.exist
                    facultyTable!.should.exist

                    await queryRunner.dropTable(studentTable!)
                    await queryRunner.dropTable(teacherTable!)
                    await queryRunner.dropTable(facultyTable!)

                    studentTable = await queryRunner.getTable("student")
                    teacherTable = await queryRunner.getTable("teacher")
                    facultyTable = await queryRunner.getTable("faculty")
                    expect(studentTable).to.be.undefined
                    expect(teacherTable).to.be.undefined
                    expect(facultyTable).to.be.undefined

                    await queryRunner.executeMemoryDownSql()

                    studentTable = await queryRunner.getTable("student")
                    teacherTable = await queryRunner.getTable("teacher")
                    facultyTable = await queryRunner.getTable("faculty")
                    studentTable!.should.exist
                    teacherTable!.should.exist
                    facultyTable!.should.exist

                    await queryRunner.release()
                }),
            ))
    })

    describe("all supported drivers except mysql family", () => {
        let connections: DataSource[]
        before(async () => {
            connections = await createTestingConnections({
                entities: [Post, Teacher, Student, Faculty],
                schemaCreate: true,
            })
        })
        beforeEach(() => reloadTestingDatabases(connections))
        after(() => closeTestingConnections(connections))

        it("should correctly drop table without relations and revert drop", () =>
            Promise.all(
                connections.map(async (connection) => {
                    // Support for check constraints in MySQL was added in version 8.0.16+ and MariaDB 10.2.1+
                    // Since check constraint in Post entity is escaped for PostgreSQL style,
                    // it will fail to create the table in MySQL/MariaDB uses backticks for escaping.
                    // So we skip this test for MySQL family databases.
                    if (DriverUtils.isMySQLFamily(connection.driver)) return
                    const queryRunner = connection.createQueryRunner()

                    let table = await queryRunner.getTable("post")
                    table!.should.exist

                    await queryRunner.dropTable("post")

                    table = await queryRunner.getTable("post")
                    expect(table).to.be.undefined

                    await queryRunner.executeMemoryDownSql()

                    table = await queryRunner.getTable("post")
                    table!.should.exist

                    await queryRunner.release()
                }),
            ))

        it("should correctly drop table with relations and revert drop", () =>
            Promise.all(
                connections.map(async (connection) => {
                    const queryRunner = connection.createQueryRunner()

                    let studentTable = await queryRunner.getTable("student")
                    let teacherTable = await queryRunner.getTable("teacher")
                    let facultyTable = await queryRunner.getTable("faculty")
                    studentTable!.should.exist
                    teacherTable!.should.exist
                    facultyTable!.should.exist

                    await queryRunner.dropTable(studentTable!)
                    await queryRunner.dropTable(teacherTable!)
                    await queryRunner.dropTable(facultyTable!)

                    studentTable = await queryRunner.getTable("student")
                    teacherTable = await queryRunner.getTable("teacher")
                    facultyTable = await queryRunner.getTable("faculty")
                    expect(studentTable).to.be.undefined
                    expect(teacherTable).to.be.undefined
                    expect(facultyTable).to.be.undefined

                    await queryRunner.executeMemoryDownSql()

                    studentTable = await queryRunner.getTable("student")
                    teacherTable = await queryRunner.getTable("teacher")
                    facultyTable = await queryRunner.getTable("faculty")
                    studentTable!.should.exist
                    teacherTable!.should.exist
                    facultyTable!.should.exist

                    await queryRunner.release()
                }),
            ))
    })
})
