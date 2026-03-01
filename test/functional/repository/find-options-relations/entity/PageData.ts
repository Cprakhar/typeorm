import {
    Entity,
    Unique,
    PrimaryGeneratedColumn,
    ManyToOne,
    Column,
} from "../../../../../src"
import PageLocaleData from "./PageLocaleData"

@Entity()
@Unique(["pageLocaleData"])
export default class PageData {
    @PrimaryGeneratedColumn("uuid")
    id: string

    @ManyToOne(
        () => PageLocaleData,
        (pageLocaleData: PageLocaleData) => pageLocaleData.data,
        { onDelete: "CASCADE" },
    )
    pageLocaleData: PageLocaleData

    @Column({ default: "" })
    title: string

    @Column({ default: 0 })
    version: number

    @Column()
    updatedAt: Date
}
