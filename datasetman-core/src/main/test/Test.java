import cn.edu.tsinghua.iginx.exception.SessionException;
import cn.edu.tsinghua.iginx.session.Session;
import cn.edu.tsinghua.iginx.session.SessionQueryDataSet;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutionException;

public class Test {

    public static void main(String[] args) throws Exception {
        Session session = new Session("127.0.0.1", 6888, "root", "root");
        session.openSession();
        queryData(session);
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

}
