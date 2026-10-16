import cn.edu.tsinghua.iginx.session.Session;
import cn.edu.tsinghua.iginx.session.SessionExecuteSqlResult;

public class QTimeTest {
    public static void main(String[] args) throws Exception {
        Session s = new Session("127.0.0.1", 6888, "root", "root");
        s.openSession();
        long id = 1789430400033L;
        String t = "relational_system.dataset_version";
        long t0 = System.currentTimeMillis();
        SessionExecuteSqlResult r1 = s.executeSql(String.format("select * from %s where createTime = %d;", t, id));
        System.out.println("where createTime= 耗时 " + (System.currentTimeMillis()-t0) + "ms 行数 " + r1.getValues().size());
        t0 = System.currentTimeMillis();
        SessionExecuteSqlResult r2 = s.executeSql(String.format("select * from %s where key = %d;", t, id));
        System.out.println("where key=       耗时 " + (System.currentTimeMillis()-t0) + "ms 行数 " + r2.getValues().size());
        t0 = System.currentTimeMillis();
        SessionExecuteSqlResult r3 = s.executeSql(String.format("select * from %s where createTime = %d;", t, id));
        System.out.println("createTime 复测   耗时 " + (System.currentTimeMillis()-t0) + "ms 行数 " + r3.getValues().size());
        s.closeSession();
    }
}
