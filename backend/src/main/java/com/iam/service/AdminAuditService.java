package com.iam.service;

import com.iam.dto.PageResponse;
import com.iam.dto.SecurityEventDto;
import com.iam.entity.SecurityEvent;
import com.iam.repository.SecurityEventRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class AdminAuditService {

    private final SecurityEventRepository securityEventRepository;

    public AdminAuditService(SecurityEventRepository securityEventRepository) {
        this.securityEventRepository = securityEventRepository;
    }

    @Transactional(readOnly = true)
    public PageResponse<SecurityEventDto> getSecurityEvents(
            String eventType,
            String username,
            String search,
            Instant startDate,
            Instant endDate,
            Pageable pageable) {

        Specification<SecurityEvent> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (eventType != null && !eventType.isBlank() && !"all".equalsIgnoreCase(eventType)) {
                predicates.add(cb.equal(root.get("eventType"), eventType.trim()));
            }

            if (username != null && !username.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("username")), "%" + username.trim().toLowerCase() + "%"));
            }

            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.trim().toLowerCase() + "%";
                Predicate matchDetails = cb.like(cb.lower(root.get("details")), pattern);
                Predicate matchIp = cb.like(cb.lower(root.get("ipAddress")), pattern);
                Predicate matchType = cb.like(cb.lower(root.get("eventType")), pattern);
                predicates.add(cb.or(matchDetails, matchIp, matchType));
            }

            if (startDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("timestamp"), startDate));
            }

            if (endDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("timestamp"), endDate));
            }

            return predicates.isEmpty() ? cb.conjunction() : cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<SecurityEvent> page = securityEventRepository.findAll(spec, pageable);

        List<SecurityEventDto> dtoList = page.getContent().stream().map(e -> {
            SecurityEventDto dto = new SecurityEventDto();
            dto.setId(e.getId());
            dto.setEventType(e.getEventType());
            dto.setUserId(e.getUserId());
            dto.setUsername(e.getUsername());
            dto.setSessionId(e.getSessionId());
            dto.setIpAddress(e.getIpAddress());
            dto.setDetails(e.getDetails());
            dto.setTimestamp(e.getTimestamp());
            return dto;
        }).collect(Collectors.toList());

        return PageResponse.of(page, dtoList);
    }
}
