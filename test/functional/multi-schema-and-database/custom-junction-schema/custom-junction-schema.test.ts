import "reflect-metadata"
import type { DataSource } from "../../../../src/data-source/DataSource"
import {
    closeTestingConnections,
    createTestingConnections,
    reloadTestingDatabases,
} from "../../../utils/test-utils"
import { Post } from "./entity/Post"
import { Category } from "./entity/Category"
import { expect } from "chai"

describe("multi-schema-and-database > custom-junction-schema", () => {
    let dataSources: DataSource[]
    before(async () => {
        dataSources = await createTestingConnections({
            entities: [Post, Category],
            enabledDrivers: ["mssql", "postgres", "sap", "cockroachdb"],
        })
    })
    beforeEach(() => reloadTestingDatabases(dataSources))
    after(() => closeTestingConnections(dataSources))

    it("should correctly create tables when custom table schema used", () =>
        Promise.all(
            dataSources.map(async (dataSource) => {
                const queryRunner = dataSource.createQueryRunner()
                try {
                    const postTable = await queryRunner.getTable("yoman.post")
                    const categoryTable =
                        await queryRunner.getTable("yoman.category")
                    const junctionMetadata = dataSource.getManyToManyMetadata(
                        Post,
                        "categories",
                    )!
                    const junctionTable = await queryRunner.getTable(
                        "yoman." + junctionMetadata.tableName,
                    )
                    expect(postTable).not.to.be.undefined
                    expect(categoryTable).not.to.be.undefined
                    expect(junctionTable).not.to.be.undefined
                    expect(postTable?.name).to.be.equal("yoman.post")
                    expect(categoryTable).not.to.be.undefined
                    expect(categoryTable?.name).to.be.equal("yoman.category")
                    expect(junctionTable).not.to.be.undefined
                    expect(junctionTable?.name).to.be.equal(
                        "yoman." + junctionMetadata.tableName,
                    )
                } finally {
                    await queryRunner.release()
                }
            }),
        ))
})
