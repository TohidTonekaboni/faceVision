import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import jalaliday from "jalaliday";

dayjs.extend(utc);
dayjs.extend(jalaliday as any);

export default dayjs;
