package com.tsinghua.auth.enums;

/**
 * 权限枚举 - 按资源类型分组的CRUD权限
 */
public enum Permission {
    // 数据源管理权限
    DATASOURCE_CREATE,
    DATASOURCE_READ,
    DATASOURCE_UPDATE,
    DATASOURCE_DELETE,
    
    // 数据表管理权限
    DATA_CREATE,
    DATA_READ,
    DATA_UPDATE,
    DATA_DELETE,

    // 用户管理权限
    USER_CREATE,
    USER_READ,
    USER_UPDATE,
    USER_DELETE,

    // 数据集管理权限
    DATASET_CREATE,
    DATASET_READ,
    DATASET_UPDATE,
    DATASET_DELETE,

    // 函数管理权限
    FUNCTION_CREATE,
    FUNCTION_READ,
    FUNCTION_UPDATE,
    FUNCTION_DELETE,

    // Transform作业编排权限
    TRANSFORM_COMPARE_CREATE,
    TRANSFORM_COMPARE_READ,
    TRANSFORM_COMPARE_UPDATE,
    TRANSFORM_COMPARE_DELETE,

    // Transform任务管理权限
    TRANSFORM_JOB_CREATE,
    TRANSFORM_JOB_READ,
    TRANSFORM_JOB_UPDATE,
    TRANSFORM_JOB_DELETE;
    
    /**
     * 获取权限描述（用于错误提示）
     */
    public String getDescription() {
        switch (this) {
            // 数据源管理权限
            case DATASOURCE_CREATE: return "创建数据源";
            case DATASOURCE_READ: return "查看数据源";
            case DATASOURCE_UPDATE: return "更新数据源";
            case DATASOURCE_DELETE: return "删除数据源";
            
            // 数据表管理权限
            case DATA_CREATE: return "创建数据";
            case DATA_READ: return "查看数据";
            case DATA_UPDATE: return "更新数据";
            case DATA_DELETE: return "删除数据";
            
            // 用户管理权限
            case USER_CREATE: return "创建用户";
            case USER_READ: return "查看用户";
            case USER_UPDATE: return "更新用户";
            case USER_DELETE: return "删除用户";

            // 数据集管理权限
            case DATASET_CREATE: return "创建数据集";
            case DATASET_READ: return "查看数据集";
            case DATASET_UPDATE: return "更新数据集";
            case DATASET_DELETE: return "删除数据集";

            // 函数管理权限
            case FUNCTION_CREATE: return "创建函数";
            case FUNCTION_READ: return "查看函数";
            case FUNCTION_UPDATE: return "更新函数";
            case FUNCTION_DELETE: return "删除函数";

            // Transform作业编排权限
            case TRANSFORM_COMPARE_CREATE: return "创建Transform作业编排";
            case TRANSFORM_COMPARE_READ: return "查看Transform作业编排";
            case TRANSFORM_COMPARE_UPDATE: return "更新Transform作业编排";
            case TRANSFORM_COMPARE_DELETE: return "删除Transform作业编排";

            // Transform任务管理权限
            case TRANSFORM_JOB_CREATE: return "创建Transform任务";
            case TRANSFORM_JOB_READ: return "查看Transform任务";
            case TRANSFORM_JOB_UPDATE: return "更新Transform任务";
            case TRANSFORM_JOB_DELETE: return "删除Transform任务";

            default: return this.name();
        }
    }
}
