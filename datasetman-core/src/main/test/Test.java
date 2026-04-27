import cn.edu.tsinghua.iginx.exception.SessionException;
import cn.edu.tsinghua.iginx.session.Session;
import cn.edu.tsinghua.iginx.session.SessionExecuteSqlResult;
import cn.edu.tsinghua.iginx.session.SessionQueryDataSet;
import cn.edu.tsinghua.iginx.session_v2.IginXClient;
import cn.edu.tsinghua.iginx.session_v2.IginXClientFactory;
import cn.edu.tsinghua.iginx.session_v2.QueryClient;
import com.tsinghua.entity.DatasetEntity;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutionException;

public class Test {

    public static void main(String[] args) throws Exception {
        Session session = new Session("127.0.0.1", 6888, "root", "root");
        session.openSession();
        String sql = "select * from %s where jobId = %s;";
        String sqlFormat= String.format(sql, "relational_system.transform_job", "7454343183099510784");
        SessionExecuteSqlResult res = session.executeSql(sqlFormat);
        res.print(false, "");
        session.closeSession();
    }

    private static void queryData(Session session) throws SessionException, ExecutionException {
        List<String> paths = new ArrayList<>();
//        paths.add("file_system.fs.image.win10\\jpg");
//        paths.add("file_system.fs.video.win7\\mp4");
//        paths.add("file_system.fs.audio.M500001VfvsJ21xFqb\\mp3");
//        paths.add("file_system.fs.doc.DEMO\\docx");
//        paths.add("file_system.fs.doc.SQLManual\\pdf");
//        paths.add("file_system.fs.doc.relational\\test_1774598630240\\xlsx");
//        paths.add("file_system.fs.doc.tree\\txt");
//        paths.add("file_system.fs.doc.userManualC\\pdf");
        paths.add("key_value.red.hash*");
//        paths.add("key_value.red.hash.value");
        long startTime = 0L;
        long endTime = Long.MAX_VALUE;

        SessionQueryDataSet dataSet = session.queryData(paths, startTime, endTime);
        dataSet.print();
    }

    public static void query(Session session) throws SessionException {
        String sql = "select * from %s where storagePath = '%s';";
        String formatSQL = String.format(sql, "relational_system.dataset_meta", "datasets.dataset01.v_260423_095801");
        System.out.println(formatSQL);
        SessionExecuteSqlResult res = session.executeSql(formatSQL);
        res.print(false, "");

        IginXClient client = IginXClientFactory.create();
        QueryClient queryClient = client.getQueryClient();
        List<DatasetEntity> pojoList =
                queryClient.query(
                        formatSQL,
                        DatasetEntity.class); // 查询最近一秒内的 pojo 对象
        client.close();
    }
}
