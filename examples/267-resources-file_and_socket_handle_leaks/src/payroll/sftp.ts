// The parts of the SFTP client the payroll uploader uses.
// Sessions and remote files are scarce: the bank allows only a few concurrent sessions per customer.

export interface RemoteFile {
    write(data: string): Promise<void>;
    // Flushes and releases the remote handle. Rejects if the flush fails; the handle is released either way.
    close(): Promise<void>;
}

export interface SftpSession {
    openWrite(path: string): Promise<RemoteFile>;
    rename(from: string, to: string): Promise<void>;
    close(): Promise<void>;
}

export interface SftpConnector {
    connect(host: string, user: string): Promise<SftpSession>;
}

export interface UploadTarget {
    host: string;
    user: string;
    dir: string;
}
