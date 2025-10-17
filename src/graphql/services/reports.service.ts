import { db } from '../../database/connection';
import { sql } from 'drizzle-orm';

export const getUsers = async () => {
    const users = await db.execute(sql`SELECT id, first_name, last_name, 'USER' as role FROM platform_users UNION SELECT id, first_name, last_name, 'ADMIN' as role FROM admin_users;`);
    return users;
}


export const getReportByIds = async (reportId: number,userIds : string[],fromDate : string,toDate : string) => {
    switch (reportId) {
        case 1:
            return await getReportByIdOne(userIds,fromDate,toDate);
        default :
            return [];
        }
  };




export const getReportByIdOne = async (userIds: string[],fromDate : string,toDate : string) => {
    try {
        const baseUrl = 'https://2bigha.ai';
        // const baseUrl = 'http://localhost:3000/'
        let whereClause;

        if (userIds && userIds.length > 0) {
          const userIdsList = sql.join(userIds.map((id) => sql`${id}`), sql`, `);
      
          whereClause = sql`
            (p.created_by_user_id IN (${userIdsList}) OR p.created_by_admin_id IN (${userIdsList}))
            AND p.created_at BETWEEN ${fromDate + " 00:00:00"} AND ${toDate + " 23:59:59"}
          `;
        } else {
          whereClause = sql`
            p.created_at BETWEEN ${fromDate + " 00:00:00"} AND ${toDate + " 23:59:59"}
          `;
        }
      
        const query = sql`
        SELECT 
          p.id,
          p.listing_id as ListingId,
          u.first_name || ' ' || u.last_name AS ListedByUser,
          a.first_name || ' ' || a.last_name AS ListedByAdmin,
          p.property_type,
          p.area,
          p.area_unit,
          p.price,
          p.price_per_unit,
          p.calculated_area,
          p.khasra_number,
          p.murabba_number,
          p.khewat_number,
          p.pin_code,
          p.address,
          p.city,
          p.district,
          p.country,
          p.published_status,
          p.approval_status,
          p.approval_message,
          p.is_active,
          p.is_featured,
          p.is_verified,
          p.owner_phone,
          p.owner_name,
          p.owner_whatsapp,
          p.approved_at,
          p.created_by_type,
          p.created_at,
          p.updated_at,
          p.availiblity_status,
          p.rejection_reason,
          p.rejected_at,
          p.admin_notes,
          (${baseUrl} || '/property/' || ps.slug) AS web_url
        FROM properties AS p
        LEFT JOIN platform_users AS u ON p.created_by_user_id = u.id
        LEFT JOIN admin_users AS a ON p.created_by_admin_id = a.id
        left join property_seo as ps on p.id = ps.property_id
        WHERE ${whereClause};
      `;
        const report = await db.execute(query);
        return report;
}catch(e) {
    throw new Error('Failed to get report');
}
}