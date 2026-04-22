package com.tsinghua.service;

import cn.edu.tsinghua.iginx.exception.SessionException;
import cn.edu.tsinghua.iginx.session.QueryDataSet;
import cn.edu.tsinghua.iginx.session.Session;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class DatasetService {

    @Autowired
    private Session iginxSession;

    public Object testSQL(String sql) {
        try {
            return iginxSession.executeQuery(sql);
        } catch (Exception e) {
            return e.getMessage();
        }
    }

}
