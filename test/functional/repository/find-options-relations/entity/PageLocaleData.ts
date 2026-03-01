import {
    Entity,
    Unique,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    OneToMany,
} from "../../../../../src"
import Page from "./Page"
import PageData from "./PageData"

@Entity()
@Unique(["page", "locale"])
export default class PageLocaleData {
    @PrimaryGeneratedColumn("uuid")
    id: string

    @Column()
    locale: string

    @ManyToOne(() => Page, (page: Page) => page.localeData, {
        onDelete: "CASCADE",
    })
    page: Page

    @OneToMany(
        () => PageData,
        (pageData: PageData) => pageData.pageLocaleData,
        { cascade: true, eager: false },
    )
    data: PageData[]
}
