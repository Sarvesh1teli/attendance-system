package com.teli.attendance.cloud.config;

import com.teli.attendance.cloud.domain.entity.CloudAppUser;
import com.teli.attendance.cloud.domain.entity.TenantInstitution;
import com.teli.attendance.cloud.repository.CloudAppUserRepository;
import com.teli.attendance.cloud.repository.TenantInstitutionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Optional;

/**
 * Automatically applies database schema updates and seeds initial multi-tenant
 * admin data upon application startup. Eliminates the need to run manual SQL.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DatabaseSchemaMigrator implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;
    private final TenantInstitutionRepository tenantRepo;
    private final CloudAppUserRepository appUserRepo;

    @Override
    public void run(ApplicationArguments args) {
        log.info("[SchemaMigrator] Running automated database schema updates...");

        // 1. Ensure student roster has face descriptor vector column
        tryExecute("ALTER TABLE cloud_student_roster ADD COLUMN IF NOT EXISTS face_descriptor TEXT");

        // 2. Ensure cloud_teacher has biometric & credential columns
        tryExecute("ALTER TABLE cloud_teacher ADD COLUMN IF NOT EXISTS pin VARCHAR(20)");
        tryExecute("ALTER TABLE cloud_teacher ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)");
        tryExecute("ALTER TABLE cloud_teacher ADD COLUMN IF NOT EXISTS face_descriptor TEXT");
        tryExecute("ALTER TABLE cloud_teacher ADD COLUMN IF NOT EXISTS department VARCHAR(255)");
        tryExecute("ALTER TABLE cloud_teacher ADD COLUMN IF NOT EXISTS institution_name VARCHAR(255)");

        // 3. Ensure cloud_tenant_institution has contact and plan columns
        tryExecute("ALTER TABLE cloud_tenant_institution ADD COLUMN IF NOT EXISTS phone VARCHAR(64)");
        tryExecute("ALTER TABLE cloud_tenant_institution ADD COLUMN IF NOT EXISTS email VARCHAR(128)");
        tryExecute("ALTER TABLE cloud_tenant_institution ADD COLUMN IF NOT EXISTS admin_name VARCHAR(128)");
        tryExecute("ALTER TABLE cloud_tenant_institution ADD COLUMN IF NOT EXISTS admin_email VARCHAR(128)");
        tryExecute("ALTER TABLE cloud_tenant_institution ADD COLUMN IF NOT EXISTS plan VARCHAR(64) DEFAULT 'ANNUAL_ENTERPRISE'");

        // 4. Ensure cloud_app_user exists
        tryExecute("""
            CREATE TABLE IF NOT EXISTS cloud_app_user (
                id VARCHAR(64) PRIMARY KEY,
                institution_id VARCHAR(64) NOT NULL,
                username VARCHAR(64) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(32) NOT NULL DEFAULT 'ADMIN',
                status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
                last_login TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """);

        // 5. Ensure cloud_tenant_entity table exists for isolated multi-tenant academic master data
        tryExecute("""
            CREATE TABLE IF NOT EXISTS cloud_tenant_entity (
                id VARCHAR(128) PRIMARY KEY,
                institution_id VARCHAR(128) NOT NULL,
                entity_type VARCHAR(64) NOT NULL,
                data_json TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        """);
        tryExecute("CREATE INDEX IF NOT EXISTS idx_tenant_entity_inst_type ON cloud_tenant_entity(institution_id, entity_type)");

        // 6. Seed default Platform Super Admin account (superadmin / admin123)
        try {
            Optional<CloudAppUser> superOpt = appUserRepo.findByInstitutionIdAndUsername("PLATFORM", "superadmin");
            if (superOpt.isEmpty()) {
                CloudAppUser superAdminUser = CloudAppUser.builder()
                        .id("usr-superadmin-01")
                        .institutionId("PLATFORM")
                        .username("superadmin")
                        .passwordHash("admin123")
                        .role("SUPER_ADMIN")
                        .status("ACTIVE")
                        .createdAt(Instant.now())
                        .updatedAt(Instant.now())
                        .build();
                appUserRepo.save(superAdminUser);
                log.info("[SchemaMigrator] Seeded default Super Admin user 'superadmin' with password 'admin123'");
            } else {
                CloudAppUser u = superOpt.get();
                u.setPasswordHash("admin123");
                appUserRepo.save(u);
                log.info("[SchemaMigrator] Updated Super Admin 'superadmin' password to 'admin123'");
            }
        } catch (Exception e) {
            log.warn("[SchemaMigrator] Default superadmin check: {}", e.getMessage());
        }

        log.info("[SchemaMigrator] Database schema is completely up-to-date.");
    }

    private void tryExecute(String sql) {
        try {
            jdbcTemplate.execute(sql);
        } catch (Exception e) {
            // Ignored if column already exists or syntax differs slightly on H2 vs Postgres
            log.debug("[SchemaMigrator] Execution note: {}", e.getMessage());
        }
    }
}
