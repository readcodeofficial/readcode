package com.gatekeep.audit;

public interface AuditSink {
    void write(LoginEvent event) throws Exception;
}
