package com.tsinghua.entity;

import cn.edu.tsinghua.iginx.session_v2.annotations.Field;
import cn.edu.tsinghua.iginx.session_v2.annotations.Measurement;
import io.swagger.annotations.ApiModelProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.Accessors;

/**
 * 函数档案实体
 * 参考数据档案，集中维护Transform/UDF注册函数的元信息（说明、创建人等）
 */
@Data
@Builder
@Accessors(chain = true)
@NoArgsConstructor
@AllArgsConstructor
@Measurement(name = "relational_system.function_archives")
public class FunctionArchiveEntity {
    @ApiModelProperty(value = "函数档案ID")
    @Field(timestamp = true)
    private Long id;

    @ApiModelProperty(value = "函数名称")
    @Field(name = "name")
    private String name;

    @ApiModelProperty(value = "函数类别：transform-转换，udf-自定义函数")
    @Field(name = "type")
    private String type;

    @ApiModelProperty(value = "UDF子类型：UDSF/UDAF/UDTF，Transform为空")
    @Field(name = "udfType")
    private String udfType;

    @ApiModelProperty(value = "脚本类名")
    @Field(name = "className")
    private String className;

    @ApiModelProperty(value = "脚本文件名")
    @Field(name = "fileName")
    private String fileName;

    @ApiModelProperty(value = "函数说明")
    @Field(name = "desc")
    private String desc;

    @ApiModelProperty(value = "创建人")
    @Field(name = "owner")
    private String owner;

    @ApiModelProperty(value = "创建时间")
    @Field(name = "createTime")
    private Long createTime;

    @ApiModelProperty(value = "扩展配置（JSON格式，预留）")
    @Field(name = "config")
    private String config;
}
