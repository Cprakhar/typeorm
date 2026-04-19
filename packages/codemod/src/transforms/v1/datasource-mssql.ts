import path from "node:path"
import type {
    API,
    FileInfo,
    ObjectExpression,
    ObjectProperty,
} from "jscodeshift"
import { fileImportsFrom, getStringValue } from "../ast-helpers"

export const name = path.basename(__filename, path.extname(__filename))
export const description =
    "migrate removed MSSQL `domain` option and fix isolation level format"

const isolationValueRenames: Record<string, string> = {
    READ_UNCOMMITTED: "READ UNCOMMITTED",
    READ_COMMITTED: "READ COMMITTED",
    REPEATABLE_READ: "REPEATABLE READ",
}

const isObjectProperty = (
    prop: ObjectExpression["properties"][number],
): prop is ObjectProperty =>
    prop.type === "Property" || prop.type === "ObjectProperty"

const getPropName = (prop: ObjectProperty): string | null => {
    if (prop.key.type === "Identifier") return prop.key.name
    return getStringValue(prop.key)
}

const isMssqlOptions = (obj: ObjectExpression): boolean =>
    obj.properties.some(
        (prop) =>
            isObjectProperty(prop) &&
            getPropName(prop) === "type" &&
            getStringValue(prop.value) === "mssql",
    )

const buildAuthenticationProperty = (
    j: API["jscodeshift"],
    props: ObjectExpression["properties"],
): ObjectProperty | null => {
    const domainProp = props.find(
        (prop): prop is ObjectProperty =>
            isObjectProperty(prop) && getPropName(prop) === "domain",
    )
    if (!domainProp) return null

    if (
        props.some(
            (prop): prop is ObjectProperty =>
                isObjectProperty(prop) &&
                getPropName(prop) === "authentication",
        )
    ) {
        return null
    }

    const authOptions: ObjectProperty[] = [
        j.objectProperty(j.identifier("domain"), domainProp.value),
    ]

    const usernameProp = props.find(
        (prop): prop is ObjectProperty =>
            isObjectProperty(prop) && getPropName(prop) === "username",
    )
    if (usernameProp) {
        authOptions.push(
            j.objectProperty(j.identifier("userName"), usernameProp.value),
        )
    }

    const passwordProp = props.find(
        (prop): prop is ObjectProperty =>
            isObjectProperty(prop) && getPropName(prop) === "password",
    )
    if (passwordProp) {
        authOptions.push(
            j.objectProperty(j.identifier("password"), passwordProp.value),
        )
    }

    return j.objectProperty(
        j.identifier("authentication"),
        j.objectExpression([
            j.objectProperty(j.identifier("type"), j.stringLiteral("ntlm")),
            j.objectProperty(
                j.identifier("options"),
                j.objectExpression(authOptions),
            ),
        ]),
    )
}

const migrateAuthentication = (
    j: API["jscodeshift"],
    objPath: { node: ObjectExpression },
): boolean => {
    const props = objPath.node.properties
    const domainIndex = props.findIndex(
        (prop) => isObjectProperty(prop) && getPropName(prop) === "domain",
    )
    const authenticationProp = buildAuthenticationProperty(j, props)
    if (domainIndex === -1 || !authenticationProp) return false

    props.splice(domainIndex + 1, 0, authenticationProp)
    objPath.node.properties = objPath.node.properties.filter(
        (prop) =>
            !isObjectProperty(prop) ||
            !["domain", "username", "password"].includes(
                getPropName(prop) ?? "",
            ),
    )
    return true
}

const migrateIsolationOptions = (objPath: {
    node: ObjectExpression
}): boolean => {
    const optionsProp = objPath.node.properties.find(
        (prop): prop is ObjectProperty =>
            isObjectProperty(prop) &&
            getPropName(prop) === "options" &&
            prop.value.type === "ObjectExpression",
    )
    if (!optionsProp) return false
    if (optionsProp.value.type !== "ObjectExpression") return false

    let hasChanges = false
    for (const prop of optionsProp.value.properties) {
        if (prop.type !== "Property" && prop.type !== "ObjectProperty") {
            continue
        }
        if (prop.key.type !== "Identifier") continue

        if (prop.key.name === "isolation") {
            prop.key.name = "isolationLevel"
            hasChanges = true
        }

        if (
            (prop.key.name === "isolationLevel" ||
                prop.key.name === "connectionIsolationLevel") &&
            prop.value.type === "StringLiteral" &&
            isolationValueRenames[prop.value.value]
        ) {
            prop.value.value = isolationValueRenames[prop.value.value]
            hasChanges = true
        }
    }

    return hasChanges
}

export const datasourceMssql = (file: FileInfo, api: API) => {
    const j = api.jscodeshift
    const root = j(file.source)

    if (!fileImportsFrom(root, j, "typeorm")) return undefined

    let hasChanges = false

    // Find object literals with `type: "mssql"`
    root.find(j.ObjectExpression).forEach((objPath) => {
        if (!isMssqlOptions(objPath.node)) return

        if (migrateAuthentication(j, objPath)) {
            hasChanges = true
        }

        if (migrateIsolationOptions(objPath)) {
            hasChanges = true
        }
    })

    return hasChanges ? root.toSource() : undefined
}

export const fn = datasourceMssql
export default fn
