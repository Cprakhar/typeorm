import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToMany,
} from "../../../../../src"
import PageLocaleData from "./PageLocaleData"

@Entity()
export default class Page {
    @PrimaryGeneratedColumn("uuid")
    id: string

    @Column()
    ownerId: string

    @Column()
    type: string

    @OneToMany(
        () => PageLocaleData,
        (pageLocaleData: PageLocaleData) => pageLocaleData.page,
        { eager: false, cascade: true },
    )
    localeData: PageLocaleData[]
}
