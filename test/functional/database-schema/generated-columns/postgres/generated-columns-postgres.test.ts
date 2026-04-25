import "reflect-metadata"
import type { DataSource } from "../../../../../src"
import { TableColumn } from "../../../../../src"
import {
    closeTestingConnections,
    createTestingConnections,
    reloadTestingDatabases,
} from "../../../../utils/test-utils"
import { expect } from "chai"

describe("database schema > generated columns > postgres", () => {
    for (const schema of [undefined, "customSchema"]) {
        describe(`schema: ${schema ?? "public"}`, () => {
            let dataSources: DataSource[]
            before(async function () {
                dataSources = await createTestingConnections({
                    entities: [__dirname + "/entity/*{.js,.ts}"],
                    enabledDrivers: ["postgres"],
                    schemaCreate: false,
                    dropSchema: true,
                    schema: schema,
                })
                if (!dataSources.length) this.skip()
            })
            beforeEach(() => reloadTestingDatabases(dataSources))
            after(() => closeTestingConnections(dataSources))

            it("should not generate queries when no model changes", () =>
                Promise.all(
                    dataSources.map(async (dataSource) => {
                        const sqlInMemory = await dataSource.driver
                            .createSchemaBuilder()
                            .log()

                        sqlInMemory.upQueries.length.should.be.equal(0)
                        sqlInMemory.downQueries.length.should.be.equal(0)
                    }),
                ))

            it("should create table with generated columns", () =>
                Promise.all(
                    dataSources.map(async (dataSource) => {
                        const queryRunner = dataSource.createQueryRunner()
                        try {
                            const table = await queryRunner.getTable("post")
                            const storedFullName =
                                table!.findColumnByName("storedFullName")!
                            const name = table!.findColumnByName("name")!
                            const nameHash =
                                table!.findColumnByName("nameHash")!

                            storedFullName.asExpression!.should.be.equal(
                                `' ' || COALESCE("firstName", '') || ' ' || COALESCE("lastName", '')`,
                            )
                            storedFullName.generatedType!.should.be.equal(
                                "STORED",
                            )

                            name.generatedType!.should.be.equal("STORED")
                            name.asExpression!.should.be.equal(
                                `"firstName" || "lastName"`,
                            )

                            nameHash.generatedType!.should.be.equal("STORED")
                            nameHash.asExpression!.should.be.equal(
                                `md5(coalesce("firstName",'0'))`,
                            )
                            nameHash.length!.should.be.equal("255")
                            nameHash.isNullable.should.be.true
                        } finally {
                            await queryRunner.release()
                        }
                    }),
                ))

            it("should add generated column and revert add", () =>
                Promise.all(
                    dataSources.map(async (dataSource) => {
                        const queryRunner = dataSource.createQueryRunner()
                        try {
                            let table = await queryRunner.getTable("post")

                            let storedColumn = new TableColumn({
                                name: "storedColumn",
                                type: "varchar",
                                length: "200",
                                generatedType: "STORED",
                                asExpression: `"firstName" || "lastName"`,
                            })

                            await queryRunner.addColumn(table!, storedColumn)

                            table = await queryRunner.getTable("post")

                            storedColumn =
                                table!.findColumnByName("storedColumn")!
                            storedColumn.should.be.exist
                            storedColumn!.generatedType!.should.be.equal(
                                "STORED",
                            )
                            storedColumn!.asExpression!.should.be.equal(
                                `"firstName" || "lastName"`,
                            )

                            // revert changes
                            await queryRunner.executeMemoryDownSql()

                            table = await queryRunner.getTable("post")
                            expect(table!.findColumnByName("column")).to.be
                                .undefined

                            // check if generated column records removed from typeorm_metadata table
                            const metadataRecords = await queryRunner.query(
                                `SELECT * FROM "${schema ?? "public"}"."typeorm_metadata" WHERE "table" = 'post' AND "name" = 'storedColumn'`,
                            )
                            metadataRecords.length.should.be.equal(0)
                        } finally {
                            await queryRunner.release()
                        }
                    }),
                ))

            it("should drop generated column and revert drop", () =>
                Promise.all(
                    dataSources.map(async (dataSource) => {
                        const queryRunner = dataSource.createQueryRunner()
                        try {
                            let table = await queryRunner.getTable("post")
                            await queryRunner.dropColumn(
                                table!,
                                "storedFullName",
                            )

                            table = await queryRunner.getTable("post")
                            expect(table!.findColumnByName("storedFullName")).to
                                .be.undefined

                            // check if generated column records removed from typeorm_metadata table
                            const metadataRecords = await queryRunner.query(
                                `SELECT * FROM "${schema ?? "public"}"."typeorm_metadata" WHERE "table" = 'post' AND "name" = 'storedFullName'`,
                            )
                            metadataRecords.length.should.be.equal(0)

                            // revert changes
                            await queryRunner.executeMemoryDownSql()

                            table = await queryRunner.getTable("post")

                            const storedFullName =
                                table!.findColumnByName("storedFullName")!
                            storedFullName.should.be.exist
                            storedFullName!.generatedType!.should.be.equal(
                                "STORED",
                            )
                            storedFullName!.asExpression!.should.be.equal(
                                `' ' || COALESCE("firstName", '') || ' ' || COALESCE("lastName", '')`,
                            )
                        } finally {
                            await queryRunner.release()
                        }
                    }),
                ))

            it("should change generated column and revert change", () =>
                Promise.all(
                    dataSources.map(async (dataSource) => {
                        const queryRunner = dataSource.createQueryRunner()
                        try {
                            let table = await queryRunner.getTable("post")

                            let storedFullName =
                                table!.findColumnByName("storedFullName")!
                            const changedStoredFullName = storedFullName.clone()
                            changedStoredFullName.asExpression = `'Mr.' || ' ' || COALESCE("firstName", '') || ' ' || COALESCE("lastName", '')`

                            let name = table!.findColumnByName("name")!
                            const changedName = name.clone()
                            changedName.generatedType = undefined
                            changedName.asExpression = undefined

                            await queryRunner.changeColumns(table!, [
                                {
                                    oldColumn: storedFullName,
                                    newColumn: changedStoredFullName,
                                },
                                { oldColumn: name, newColumn: changedName },
                            ])

                            table = await queryRunner.getTable("post")

                            storedFullName =
                                table!.findColumnByName("storedFullName")!
                            storedFullName!.asExpression!.should.be.equal(
                                `'Mr.' || ' ' || COALESCE("firstName", '') || ' ' || COALESCE("lastName", '')`,
                            )

                            name = table!.findColumnByName("name")!
                            expect(name!.generatedType).to.be.undefined
                            expect(name!.asExpression).to.be.undefined

                            // check if generated column records removed from typeorm_metadata table
                            const metadataRecords = await queryRunner.query(
                                `SELECT * FROM "${schema ?? "public"}"."typeorm_metadata" WHERE "table" = 'post' AND "name" = 'name' AND "schema" = '${schema ?? "public"}'`,
                            )
                            metadataRecords.length.should.be.equal(0)

                            // revert changes
                            await queryRunner.executeMemoryDownSql()

                            table = await queryRunner.getTable("post")

                            storedFullName =
                                table!.findColumnByName("storedFullName")!
                            storedFullName!.asExpression!.should.be.equal(
                                `' ' || COALESCE("firstName", '') || ' ' || COALESCE("lastName", '')`,
                            )

                            name = table!.findColumnByName("name")!

                            name.generatedType!.should.be.equal("STORED")
                            name.asExpression!.should.be.equal(
                                `"firstName" || "lastName"`,
                            )
                        } finally {
                            await queryRunner.release()
                        }
                    }),
                ))
            it("should rename generated column metadata row and revert rename", () =>
                Promise.all(
                    dataSources.map(async (dataSource) => {
                        const queryRunner = dataSource.createQueryRunner()
                        try {
                            let table = await queryRunner.getTable("post")
                            if (table) {
                                await queryRunner.renameColumn(
                                    table,
                                    "storedFullName",
                                    "storedFullNameRenamed",
                                )
                            }

                            table = await queryRunner.getTable("post")

                            const oldColumn =
                                table?.findColumnByName("storedFullName")
                            expect(oldColumn).to.be.undefined
                            const renamedColumn = table?.findColumnByName(
                                "storedFullNameRenamed",
                            )
                            expect(renamedColumn).to.exist
                            renamedColumn?.asExpression?.should.be.equal(
                                `' ' || COALESCE("firstName", '') || ' ' || COALESCE("lastName", '')`,
                            )

                            const oldMetadataRecords = await queryRunner.query(
                                `SELECT * FROM "${schema ?? "public"}"."typeorm_metadata" WHERE "table" = 'post' AND "name" IN ('storedFullName', 'virtualFullName') AND "schema" = '${schema ?? "public"}'`,
                            )
                            oldMetadataRecords.length.should.be.equal(0)

                            const renamedMetadataRecords =
                                await queryRunner.query(
                                    `SELECT * FROM "${schema ?? "public"}"."typeorm_metadata" WHERE "table" = 'post' AND "name" = 'storedFullNameRenamed' AND "schema" = '${schema ?? "public"}'`,
                                )
                            renamedMetadataRecords.length.should.be.equal(1)

                            // revert changes
                            await queryRunner.executeMemoryDownSql()

                            table = await queryRunner.getTable("post")

                            const revertedColumn =
                                table?.findColumnByName("storedFullName")
                            expect(revertedColumn).to.exist
                            revertedColumn?.asExpression?.should.be.equal(
                                `' ' || COALESCE("firstName", '') || ' ' || COALESCE("lastName", '')`,
                            )
                            expect(
                                table?.findColumnByName(
                                    "storedFullNameRenamed",
                                ),
                            ).to.be.undefined

                            const revertedMetadataRecords =
                                await queryRunner.query(
                                    `SELECT * FROM "${schema ?? "public"}"."typeorm_metadata" WHERE "table" = 'post' AND "name" = 'storedFullName' AND "schema" = '${schema ?? "public"}'`,
                                )
                            revertedMetadataRecords.length.should.be.equal(1)

                            const revertedRenamedMetadataRecords =
                                await queryRunner.query(
                                    `SELECT * FROM "${schema ?? "public"}"."typeorm_metadata" WHERE "table" = 'post' AND "name" = 'storedFullNameRenamed' AND "schema" = '${schema ?? "public"}'`,
                                )
                            revertedRenamedMetadataRecords.length.should.be.equal(
                                0,
                            )
                        } finally {
                            await queryRunner.release()
                        }
                    }),
                ))

            it("should rename table with generated columns and revert rename", () =>
                Promise.all(
                    dataSources.map(async (dataSource) => {
                        const queryRunner = dataSource.createQueryRunner()
                        try {
                            let table = await queryRunner.getTable("post")
                            if (table)
                                await queryRunner.renameTable(
                                    table,
                                    "postRenamed",
                                )

                            table = await queryRunner.getTable("postRenamed")
                            expect(table).to.exist

                            const storedFullName =
                                table?.findColumnByName("storedFullName")
                            expect(storedFullName).to.exist
                            storedFullName?.asExpression?.should.be.equal(
                                `' ' || COALESCE("firstName", '') || ' ' || COALESCE("lastName", '')`,
                            )

                            const name = table?.findColumnByName("name")
                            expect(name).to.exist
                            name?.asExpression?.should.be.equal(
                                `"firstName" || "lastName"`,
                            )

                            // check if generated column records exist in typeorm_metadata table with new table name
                            const metadataRecords = await queryRunner.query(
                                `SELECT * FROM "${schema ?? "public"}"."typeorm_metadata" WHERE "table" = 'postRenamed' AND "name" IN ('storedFullName', 'name') AND "schema" = '${schema ?? "public"}'`,
                            )
                            metadataRecords.length.should.be.equal(2)

                            // revert changes
                            await queryRunner.executeMemoryDownSql()

                            table = await queryRunner.getTable("post")
                            expect(table).to.exist

                            const revertedFullName =
                                table?.findColumnByName("storedFullName")
                            expect(revertedFullName).to.exist
                            revertedFullName?.asExpression?.should.be.equal(
                                `' ' || COALESCE("firstName", '') || ' ' || COALESCE("lastName", '')`,
                            )

                            const revertedName = table?.findColumnByName("name")
                            expect(revertedName).to.exist
                            revertedName?.asExpression?.should.be.equal(
                                `"firstName" || "lastName"`,
                            )

                            // check if generated column records exist in typeorm_metadata table with old table name
                            const revertedMetadataRecords =
                                await queryRunner.query(
                                    `SELECT * FROM "${schema ?? "public"}"."typeorm_metadata" WHERE "table" = 'post' AND "name" IN ('storedFullName', 'name') AND "schema" = '${schema ?? "public"}'`,
                                )
                            revertedMetadataRecords.length.should.be.equal(2)
                        } finally {
                            await queryRunner.release()
                        }
                    }),
                ))

            it("should remove data from 'typeorm_metadata' when table dropped", () =>
                Promise.all(
                    dataSources.map(async (dataSource) => {
                        const queryRunner = dataSource.createQueryRunner()
                        try {
                            const table = await queryRunner.getTable("post")
                            const generatedColumns = table!.columns.filter(
                                (it) => it.generatedType,
                            )

                            await queryRunner.dropTable(table!)

                            // check if generated column records removed from typeorm_metadata table
                            let metadataRecords = await queryRunner.query(
                                `SELECT * FROM "${schema ?? "public"}"."typeorm_metadata" WHERE "table" = 'post' AND "schema" = '${schema ?? "public"}'`,
                            )
                            metadataRecords.length.should.be.equal(0)

                            // revert changes
                            await queryRunner.executeMemoryDownSql()

                            metadataRecords = await queryRunner.query(
                                `SELECT * FROM "${schema ?? "public"}"."typeorm_metadata" WHERE "table" = 'post' AND "schema" = '${schema ?? "public"}'`,
                            )
                            metadataRecords.length.should.be.equal(
                                generatedColumns.length,
                            )
                        } finally {
                            await queryRunner.release()
                        }
                    }),
                ))
        })
    }
})
