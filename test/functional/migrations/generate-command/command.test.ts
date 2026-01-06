import "reflect-metadata"
import {
    closeTestingConnections,
    createTestingConnections,
} from "../../../utils/test-utils"
import { DataSource } from "../../../../src/data-source/DataSource"
import { Category, Post } from "./entity"
import { CheckConstraintEntity } from "./entity/check.entity"
import { CheckConstraintEntityModified } from "./entity/check-modified.entity"
import { DriverUtils } from "../../../../src/driver/DriverUtils"

describe("migrations > generate command", () => {
    let connections: DataSource[]
    before(
        async () =>
            (connections = await createTestingConnections({
                migrations: [],
                schemaCreate: false,
                dropSchema: true,
                entities: [Post, Category],
            })),
    )
    after(() => closeTestingConnections(connections))

    it("can recognize model changes", () =>
        Promise.all(
            connections.map(async (connection) => {
                const sqlInMemory = await connection.driver
                    .createSchemaBuilder()
                    .log()
                sqlInMemory.upQueries.length.should.be.greaterThan(0)
                sqlInMemory.downQueries.length.should.be.greaterThan(0)
            }),
        ))

    it("does not generate when no model changes", () =>
        Promise.all(
            connections.map(async (connection) => {
                await connection.driver.createSchemaBuilder().build()

                const sqlInMemory = await connection.driver
                    .createSchemaBuilder()
                    .log()

                sqlInMemory.upQueries.length.should.be.equal(0)
                sqlInMemory.downQueries.length.should.be.equal(0)
            }),
        ))
})

describe("migrations > generate command with check constraints", () => {
    let connections: DataSource[]
    before(
        async () =>
            (connections = await createTestingConnections({
                migrations: [],
                schemaCreate: false,
                dropSchema: true,
                entities: [CheckConstraintEntity],
            })),
    )
    after(() => closeTestingConnections(connections))

    it("can recognize model changes with check constraints", () =>
        Promise.all(
            connections.map(async (connection) => {
                const sqlInMemory = await connection.driver
                    .createSchemaBuilder()
                    .log()
                sqlInMemory.upQueries.length.should.be.greaterThan(0)
                sqlInMemory.downQueries.length.should.be.greaterThan(0)
            }),
        ))

    it("does not generate when no model changes with check constraints", () =>
        Promise.all(
            connections.map(async (connection) => {
                await connection.driver.createSchemaBuilder().build()

                const sqlInMemory = await connection.driver
                    .createSchemaBuilder()
                    .log()

                sqlInMemory.upQueries.length.should.be.equal(0)
                sqlInMemory.downQueries.length.should.be.equal(0)
            }),
        ))
})

describe("migrations > generate command with check constraint changes", () => {
    it("should recognize changes in check constraint logic", async () =>
        Promise.all(
            // Test with original check constraints
            (
                await createTestingConnections({
                    name: "original",
                    migrations: [],
                    schemaCreate: false,
                    dropSchema: true,
                    entities: [CheckConstraintEntity],
                })
            ).map(async (connection) => {
                // MySQL does not support check constraints
                if (DriverUtils.isMySQLFamily(connection.driver)) return

                try {
                    // Build schema with original check constraints
                    await connection.driver.createSchemaBuilder().build()

                    // Close and recreate connection with modified entities
                    await connection.destroy()

                    const modifiedConnection = await createTestingConnections({
                        name: "modified",
                        migrations: [],
                        schemaCreate: false,
                        dropSchema: false, // Keep existing schema
                        entities: [CheckConstraintEntityModified],
                    })

                    const [modConn] = modifiedConnection

                    try {
                        // Check if migrations are generated for the modified check constraints
                        const sqlInMemory = await modConn.driver
                            .createSchemaBuilder()
                            .log()

                        // Should generate migration queries for check constraint changes
                        sqlInMemory.upQueries.length.should.be.greaterThan(0)
                        sqlInMemory.downQueries.length.should.be.greaterThan(0)

                        // Verify the queries contain check constraint modifications
                        const hasCheckConstraintChanges =
                            sqlInMemory.upQueries.some(
                                (query) =>
                                    query.query
                                        .toLowerCase()
                                        .includes("check") ||
                                    query.query
                                        .toLowerCase()
                                        .includes("constraint"),
                            )
                        hasCheckConstraintChanges.should.be.true
                    } finally {
                        await closeTestingConnections(modifiedConnection)
                    }
                } catch (error) {
                    // Clean up on error
                    if (!connection.isInitialized) {
                        await connection.destroy().catch(() => {})
                    }
                    throw error
                }
            }),
        ))
})
